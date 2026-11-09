import { getAuth } from "@/identity/better-auth";

/**
 * Better Auth HTTP surface: /api/auth/* — sign-up, sign-in, sign-out, session,
 * email verification, password reset, 2FA.
 *
 * Node.js runtime (not Edge): Argon2id is a native binding and the database
 * driver needs raw TCP.
 *
 * `getAuth()` is called per request on purpose: constructing it at module scope
 * would make `next build` require DATABASE_URL, since Next imports route
 * modules while collecting page data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
