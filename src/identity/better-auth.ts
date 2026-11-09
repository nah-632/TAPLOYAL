import { randomUUID } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";

import { getDb } from "@/db/client";
import { authSchema } from "@/db/sql/auth";

/**
 * Better Auth configuration — directive §4.
 *
 * Security decisions encoded here (each one deliberate):
 *  - Argon2id password hashing via @node-rs/argon2 (native binding, no JS
 *    fallback). Parameters are the OWASP baseline (19 MiB, t=2, p=1).
 *  - HttpOnly cookies always; `Secure` only in production so local dev over
 *    http still works (a Secure cookie is silently dropped over http).
 *  - SameSite=Lax — the staff PWA and the dashboard are same-site.
 *  - Session cookie cache DISABLED: revocation must take effect immediately,
 *    which §4 requires.
 *  - Rate limiting on by default, stricter on credential endpoints.
 *  - TOTP 2FA available; the super-admin role is additionally gated by
 *    authorize() in src/identity/rbac.ts.
 *
 * DIRECTORY: `src/identity/` — `src/auth` is un-creatable here (ADR-001 §17).
 */

const isProd = process.env.NODE_ENV === "production";
const secret = process.env.BETTER_AUTH_SECRET;

if (isProd && !secret) {
  // Fail closed: never boot production on an implicit secret.
  throw new Error("BETTER_AUTH_SECRET must be set in production");
}

export const auth = betterAuth({
  secret: secret ?? "dev-only-insecure-secret-do-not-use-in-production",
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",

  database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 256,
    autoSignIn: false,
    password: {
      hash: (password: string) =>
        argonHash(password, {
          algorithm: 2, // Argon2id
          memoryCost: 19456, // 19 MiB
          timeCost: 2,
          parallelism: 1,
        }),
      verify: ({ hash, password }: { hash: string; password: string }) =>
        argonVerify(hash, password),
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },

  advanced: {
    /**
     * FINDING (2026-11-09): Better Auth defaults to random STRING ids
     * (e.g. "rXL1pyAqdDzNxsQDj1kKQIWrmkQ0AXfV"). Our profile table `users.id` is
     * a uuid — as required by directive §3 ("UUID Primary Keys") — so lookups
     * failed with a type error. Forcing uuid generation keeps every primary key
     * a real UUID and lets `users.id` share the identity's id directly.
     */
    database: {
      generateId: () => randomUUID(),
    },
    useSecureCookies: isProd,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 300, max: 5 },
      "/forget-password": { window: 300, max: 5 },
    },
  },

  trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.APP_URL].filter(
    (v): v is string => Boolean(v),
  ),

  plugins: [twoFactor({ issuer: "taployal" })],
});

export type Auth = typeof auth;
