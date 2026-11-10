import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { merchants, users } from "@/db/sql/tenancy";
import { withTenant } from "@/db/tenant";

/**
 * Merchant onboarding under RLS — and why this needs NO privilege escalation.
 *
 * The naive worry: the `merchants` and `users` policies are
 * `... OR id = app_merchant_id()`, so how can a brand-new merchant ever be
 * inserted when no tenant exists yet?
 *
 * The answer: the tenant context is the id of the merchant ABOUT TO BE CREATED,
 * generated on the SERVER (`randomUUID()`), never accepted from the client. The
 * insert satisfies the policy's WITH CHECK for exactly that one new row.
 *
 * WHY THERE IS NO "is this slug free?" PRE-CHECK (fixed 2026-11-09):
 *   Slug uniqueness is GLOBAL, but any SELECT on `merchants` runs under the
 *   tenant policy, which hides every other tenant's rows — so the check always
 *   reported "free" and the collision surfaced later as a 500 from the unique
 *   index. Rather than widen visibility (a super-admin read, or SECURITY
 *   DEFINER), this now attempts the insert optimistically and retries with a
 *   suffix on a unique violation. That keeps tenant isolation untouched.
 */

export class OnboardingError extends Error {}

export interface OnboardingInput {
  /** Verified Better Auth identity. */
  userId: string;
  email: string;
  merchantName: string;
  /** cafe | restaurant | salon | retail | specialty | other (BUILD-PROMPT §3.A step 6). */
  businessType?: string;
  country?: string;
  city?: string;
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
}

export function normalizeSlug(merchantName: string): string {
  const slug = merchantName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || `merchant-${randomUUID().slice(0, 8)}`;
}

/** Walks the driver's error chain looking for a PostgreSQL unique violation. */
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const e = current as { code?: string; constraint_name?: string; constraint?: string; cause?: unknown };
    if (e.code === "23505") {
      const name = e.constraint_name ?? e.constraint ?? "";
      if (!constraint || name.includes(constraint)) return true;
    }
    current = e.cause;
  }
  return false;
}

/**
 * Creates the merchant and the owner profile row in ONE transaction, scoped to
 * a freshly generated merchant id. Retries with a numeric slug suffix when a
 * merchant already owns that slug.
 */
export async function createMerchantForOwner(
  input: OnboardingInput,
  db?: ReturnType<typeof getDb>,
): Promise<{ merchantId: string; slug: string }> {
  const database = db ?? getDb();
  const merchantId = randomUUID();
  const base = normalizeSlug(input.merchantName);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return await withTenant(
        { merchantId, userId: input.userId, role: "merchant_owner" },
        async (tx) => {
          const scoped = tx as unknown as ReturnType<typeof getDb>;
          await scoped.insert(merchants).values({
            id: merchantId,
            businessName: input.merchantName,
            slug,
            businessType: input.businessType ?? null,
            city: input.city ?? null,
            currency: input.currency ?? "BHD",
            contactEmail: input.email,
            ownerUserId: input.userId,
            country: input.country ?? "BH",
            timezone: input.timezone ?? "Asia/Bahrain",
            defaultLanguage: input.defaultLanguage ?? "ar",
            status: "active",
          });
          await scoped.insert(users).values({
            id: input.userId,
            email: input.email,
            role: "merchant_owner",
            merchantId,
            isActive: true,
          });
          return { merchantId, slug };
        },
        database as never,
      );
    } catch (error) {
      // The whole tenant transaction rolled back, so retrying is safe.
      if (isUniqueViolation(error, "merchants_slug_key")) continue;
      throw error;
    }
  }

  throw new OnboardingError("could not allocate a unique slug");
}

/** True when this identity already has a merchant (used to make onboarding idempotent). */
export async function hasMerchant(
  userId: string,
  db?: ReturnType<typeof getDb>,
): Promise<boolean> {
  const database = db ?? getDb();
  const rows = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows.length > 0;
}
