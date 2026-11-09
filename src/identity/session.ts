import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { users } from "@/db/sql/tenancy";
import type { TenantContext, UserRole } from "@/db/tenant";
import { AuthorizationError, authorize, type Permission } from "@/identity/rbac";

/**
 * Session -> tenant context.
 *
 * The chain is: Better Auth session (cookie, verified server-side) ->
 * the identity row -> our `users` profile row -> { role, merchantId }.
 *
 * The merchant id is read from the DATABASE, keyed by the authenticated user.
 * It is never taken from a header, body, query parameter or client storage —
 * the core requirement of directive §5.
 */

export interface SessionUser {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
}

export interface ResolvedSession extends TenantContext {
  email: string;
  twoFactorEnabled: boolean;
}

export class SessionResolutionError extends Error {}

/** Pure mapping step, unit-testable without a database. */
export function toResolvedSession(
  sessionUser: SessionUser | null | undefined,
  profile: { role: UserRole; merchantId: string | null; isActive: boolean } | null | undefined,
): ResolvedSession {
  if (!sessionUser) throw new SessionResolutionError("no session");
  if (!profile) throw new SessionResolutionError("session user has no profile row");
  if (!profile.isActive) throw new SessionResolutionError("account is disabled");

  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && !profile.merchantId) {
    throw new SessionResolutionError("tenant role without a merchant");
  }

  return {
    merchantId: profile.merchantId,
    userId: sessionUser.id,
    role: profile.role,
    email: sessionUser.email,
    twoFactorEnabled: sessionUser.twoFactorEnabled,
  };
}

/**
 * Loads the profile row for an authenticated identity.
 * `db` is injectable so this can be tested without a live connection.
 */
export async function loadProfile(
  userId: string,
  db?: ReturnType<typeof getDb>,
): Promise<{ role: UserRole; merchantId: string | null; isActive: boolean } | null> {
  const database = db ?? getDb();
  const rows = await database
    .select({
      role: users.role,
      merchantId: users.merchantId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Resolves a full session into the tenant context used by withTenant(). */
export async function resolveSession(
  sessionUser: SessionUser | null | undefined,
  db?: ReturnType<typeof getDb>,
): Promise<ResolvedSession> {
  if (!sessionUser) throw new AuthorizationError("no session", "unauthenticated");
  const profile = await loadProfile(sessionUser.id, db);
  return toResolvedSession(sessionUser, profile);
}

/** Authorization gate that returns the resolved session or throws. */
export async function requirePermission(
  sessionUser: SessionUser | null | undefined,
  permission: Permission,
  db?: ReturnType<typeof getDb>,
): Promise<ResolvedSession> {
  const session = await resolveSession(sessionUser, db);
  authorize({
    role: session.role,
    merchantId: session.merchantId,
    twoFactorEnabled: session.twoFactorEnabled,
    permission,
  });
  return session;
}

/**
 * A super admin acting on a specific merchant must do so explicitly, so the
 * tenant context stays auditable rather than "whatever the query happened to hit".
 */
export function asPlatformActorActingOn(session: ResolvedSession, merchantId: string) {
  if (session.role !== "super_admin") {
    throw new AuthorizationError("only a super admin may act on another merchant");
  }
  if (session.merchantId) {
    throw new AuthorizationError("super admin accounts must not carry a merchant id");
  }
  return { ...session, merchantId, impersonated: true as const };
}
