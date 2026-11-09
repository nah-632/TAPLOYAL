import { sql } from "drizzle-orm";

import { getDb } from "./client";

/**
 * W3.1 / W3.2 — the SERVER-SIDE tenant layer.
 *
 * Directive §5:
 *   "لا تقبل Merchant ID من المتصفح باعتباره مصدرًا موثوقًا للصلاحية."
 *   "استخرج هوية المستخدم والتاجر من Session موثوقة."
 *
 * This module is the only sanctioned way to reach tenant data. It:
 *   1. refuses to run without a merchant id  -> fails CLOSED, never open
 *   2. validates the id is a real uuid       -> no SQL-typed surprises
 *   3. sets `app.merchant_id` with set_config(..., is_local = true) inside the
 *      transaction, so the native RLS policies bind for exactly that scope
 *   4. additionally sets `app.is_super_admin` only when the session says so
 *
 * Because the setting is transaction-local it cannot leak to the next request
 * even on a pooled connection.
 */

export type UserRole = "merchant_owner" | "staff" | "super_admin";

export interface TenantContext {
  /** Comes from the verified session. NEVER from a request body or query string. */
  merchantId: string | null;
  userId: string;
  role: UserRole;
}

export class MissingTenantContextError extends Error {
  constructor(message = "tenant context is missing a merchant id — refusing to run") {
    super(message);
    this.name = "MissingTenantContextError";
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pure validation, extracted so it is unit-testable without a database.
 * Throws instead of returning a falsy value: a caller that ignores a boolean
 * would silently run unscoped.
 */
export function assertTenantContext(ctx: Partial<TenantContext> | null | undefined): {
  merchantId: string;
  userId: string;
  isSuperAdmin: boolean;
} {
  if (!ctx) throw new MissingTenantContextError("no session context provided");
  if (!ctx.userId) throw new MissingTenantContextError("session has no user id");
  if (!ctx.merchantId) {
    throw new MissingTenantContextError(
      "session has no merchant id (super admins must use an explicit platform scope)",
    );
  }
  if (!UUID_RE.test(ctx.merchantId)) {
    throw new MissingTenantContextError(`merchant id is not a uuid: ${ctx.merchantId}`);
  }
  return {
    merchantId: ctx.merchantId,
    userId: ctx.userId,
    isSuperAdmin: ctx.role === "super_admin",
  };
}

/** Minimal shape this module needs, so tests can inject a fake. */
export interface TenantDb {
  transaction<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T>;
}
export interface TenantTx {
  execute(query: unknown): Promise<unknown>;
}

/**
 * Runs `fn` inside a transaction scoped to one tenant.
 * The optional `db` parameter exists for testing; production calls omit it.
 */
export async function withTenant<T>(
  ctx: Partial<TenantContext> | null | undefined,
  fn: (tx: TenantTx) => Promise<T>,
  db?: TenantDb,
): Promise<T> {
  const { merchantId, isSuperAdmin } = assertTenantContext(ctx);
  const database = db ?? (getDb() as unknown as TenantDb);

  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.merchant_id', ${merchantId}, true)`,
    );
    if (isSuperAdmin) {
      await tx.execute(sql`select set_config('app.is_super_admin', 'true', true)`);
    }
    return fn(tx);
  });
}
