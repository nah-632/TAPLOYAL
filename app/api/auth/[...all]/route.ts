import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/identity/better-auth";

/**
 * Better Auth HTTP surface: /api/auth/* — sign-up, sign-in, sign-out, session,
 * email verification, password reset, 2FA.
 *
 * Node.js runtime (not Edge) because Argon2id is a native binding and the
 * database driver needs raw TCP.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler(auth);
