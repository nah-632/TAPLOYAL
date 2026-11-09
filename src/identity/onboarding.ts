import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { merchants, users } from "@/db/sql/tenancy";
import { withTenant } from "@/db/tenant";

/**
 * Merchant onboarding under RLS — and why this needs NO privilege escalation.
 *
 * The naive worry: the `merchants` and `users` policies are
 * `... OR id = app_merchant_id()` / `... OR merchant_id = app_merchant_id()`,
 * so how can a brand-new merchant ever be inserted when no tenant exists yet?
 *
 * The answer: the tenant context for onboarding is the id of the merchant
 * ABOUT TO BE CREATED, and that id is generated on the SERVER
 * (`randomUUID()`), never accepted from the client. The insert then satisfies
 * the policy's WITH CHECK for exactly that one new row and nothing else.
 *
 * What this does NOT allow: a caller cannot target an existing tenant, because
 * the id is not supplied by the caller. Cross-tenant reads/writes remain denied
 * by the same policies the isolation suite exercises.
 *
 * This is deliberately NOT a SECURITY DEFINER function — no privilege is
 * escalated, so there is nothing extra to audit.
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
  return merchantName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function onboardingSlug(
  merchantName: string,
  db?: ReturnType<typeof getDb>,
): Promise<string> {
  const database = db ?? getDb();
  const base = normalizeSlug(merchantName);
  if (!base) throw new OnboardingError("merchant name produces an empty slug");

  // Slugs are globally unique; resolve collisions deterministically.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await database
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.slug, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  throw new OnboardingError("could not allocate a unique slug");
}

/**
 * Creates the merchant and the owner profile row in ONE transaction, scoped to
 * the freshly generated merchant id.
 */
export async function createMerchantForOwner(
  input: OnboardingInput,
  db?: ReturnType<typeof getDb>,
): Promise<{ merchantId: string; slug: string }> {
  const database = db ?? getDb();
  const merchantId = randomUUID();
  const slug = await onboardingSlug(input.merchantName, database);

  return withTenant(
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
}
