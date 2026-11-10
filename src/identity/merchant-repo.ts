import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { loyaltyCards, rewards } from "@/db/sql/loyalty";
import { merchants as merchantsTable } from "@/db/sql/tenancy";
import { withTenant, type TenantContext } from "@/db/tenant";

/**
 * Merchant/card repository. Every function takes a TenantContext that came from
 * the verified session and runs inside withTenant(), so RLS scopes each
 * statement and the merchant id is never read from the request.
 *
 * The wizard updates rows step by step, so the merchants/cards are read back on
 * each step rather than carried in a client-side draft — a client-held draft
 * would be an untrusted source of tenant data.
 */

export interface MerchantBranding {
  businessName: string;
  slug: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
}

export interface CardProgram {
  id: string;
  name: string;
  mode: "points" | "stamps";
  stampsRequired: number | null;
  stampIcon: string | null;
  pointsPerUnit: number | null;
  labelColor: string | null;
  termsText: string | null;
  status: "draft" | "published";
}

export async function getMerchant(ctx: TenantContext): Promise<MerchantBranding | null> {
  return withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    const rows = await db
      .select({
        businessName: merchantsTable.businessName,
        slug: merchantsTable.slug,
        primaryColor: merchantsTable.primaryColor,
        secondaryColor: merchantsTable.secondaryColor,
        logoUrl: merchantsTable.logoUrl,
      })
      .from(merchantsTable)
      .where(eq(merchantsTable.id, ctx.merchantId!))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function updateBranding(
  ctx: TenantContext,
  input: { primaryColor?: string; secondaryColor?: string; logoUrl?: string },
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    await db
      .update(merchantsTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(merchantsTable.id, ctx.merchantId!));
  });
}

/** The wizard works on one draft card per merchant. */
export async function getOrCreateDraftCard(ctx: TenantContext): Promise<CardProgram> {
  return withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    const existing = await db
      .select()
      .from(loyaltyCards)
      .where(
        and(
          eq(loyaltyCards.merchantId, ctx.merchantId!),
          eq(loyaltyCards.status, "draft"),
        ),
      )
      .limit(1);
    if (existing[0]) return toProgram(existing[0]);

    const inserted = await db
      .insert(loyaltyCards)
      .values({
        merchantId: ctx.merchantId!,
        name: "",
        mode: "stamps",
        stampsRequired: 8,
        stampIcon: "coffee",
        status: "draft",
      })
      .returning();
    return toProgram(inserted[0]!);
  });
}

export async function updateCard(
  ctx: TenantContext,
  cardId: string,
  input: Partial<{
    name: string;
    mode: "points" | "stamps";
    stampsRequired: number | null;
    stampIcon: string | null;
    pointsPerUnit: number | null;
    labelColor: string | null;
    termsText: string | null;
  }>,
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    await db
      .update(loyaltyCards)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(loyaltyCards.id, cardId), eq(loyaltyCards.merchantId, ctx.merchantId!)));
  });
}

export async function publishCard(ctx: TenantContext, cardId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    await db
      .update(loyaltyCards)
      .set({ status: "published", updatedAt: new Date() })
      .where(and(eq(loyaltyCards.id, cardId), eq(loyaltyCards.merchantId, ctx.merchantId!)));
  });
}

export async function listRewards(
  ctx: TenantContext,
  cardId: string,
): Promise<{ id: string; name: string; cost: number; isActive: boolean }[]> {
  return withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    return db
      .select({
        id: rewards.id,
        name: rewards.name,
        cost: rewards.cost,
        isActive: rewards.isActive,
      })
      .from(rewards)
      .where(and(eq(rewards.merchantId, ctx.merchantId!), eq(rewards.cardId, cardId)));
  });
}

export async function createReward(
  ctx: TenantContext,
  cardId: string,
  input: { name: string; cost: number },
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const db = tx as unknown as ReturnType<typeof getDb>;
    await db.insert(rewards).values({
      merchantId: ctx.merchantId!,
      cardId,
      name: input.name,
      cost: input.cost,
      isActive: true,
    });
  });
}

function toProgram(row: typeof loyaltyCards.$inferSelect): CardProgram {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    stampsRequired: row.stampsRequired,
    stampIcon: row.stampIcon,
    pointsPerUnit: row.pointsPerUnit,
    labelColor: row.labelColor,
    termsText: row.termsText,
    status: row.status,
  };
}

