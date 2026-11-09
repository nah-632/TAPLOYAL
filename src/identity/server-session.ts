import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/identity/better-auth";
import { loadProfile, toResolvedSession, type ResolvedSession } from "@/identity/session";

/**
 * Server-side session resolution for Server Components and Server Actions.
 *
 * This is the ONLY place a request turns into a tenant context. Callers never
 * accept a merchant id from a form, a query string or a header.
 */

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

/** Raw Better Auth session, or null. Never throws. */
export async function getServerSession(): Promise<AuthedUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as {
    id: string;
    email: string;
    name?: string;
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
  };
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? u.email,
    emailVerified: Boolean(u.emailVerified),
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
  };
}

/**
 * Session + profile row -> tenant context.
 * Returns null when the account exists but has not completed onboarding yet,
 * which is a normal state, not an error.
 */
export async function getTenantSession(): Promise<ResolvedSession | null> {
  const user = await getServerSession();
  if (!user) return null;
  const profile = await loadProfile(user.id);
  if (!profile) return null;
  return toResolvedSession(
    { id: user.id, email: user.email, twoFactorEnabled: user.twoFactorEnabled },
    profile,
  );
}

/** Redirects instead of throwing, so pages stay readable. */
export async function requireUser(next = "/dashboard"): Promise<AuthedUser> {
  const user = await getServerSession();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

/** Requires a fully onboarded merchant owner or staff account. */
export async function requireTenant(next = "/dashboard"): Promise<ResolvedSession> {
  const session = await getTenantSession();
  if (session) return session;

  const user = await getServerSession();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  // Signed in but no business yet -> the setup wizard, which is step 5 of the
  // merchant journey in BUILD-PROMPT §3.A.
  redirect("/onboarding");
}
