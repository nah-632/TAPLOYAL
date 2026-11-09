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
 * LAZY BY DESIGN. An eager `betterAuth({ database: drizzleAdapter(getDb()) })`
 * calls getDb() at module load, and Next.js imports route modules during
 * `next build` — so the build would demand DATABASE_URL and fail before any
 * request is served. Deferring construction to the first request keeps the
 * build free of runtime secrets.
 *
 * Security decisions encoded here (each one deliberate):
 *  - Argon2id via @node-rs/argon2 (native binding). OWASP baseline params.
 *  - HttpOnly cookies always; `Secure` only in production so local http dev works.
 *  - SameSite=Lax — staff PWA and dashboard are same-site.
 *  - Session cookie cache DISABLED: revocation must be immediate (§4).
 *  - Rate limiting on, stricter on credential endpoints.
 *  - TOTP 2FA available; the super-admin role is gated again by authorize()
 *    in src/identity/rbac.ts.
 */

const isProd = process.env.NODE_ENV === "production";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (isProd && !secret) {
    // Fail closed: never boot production on an implicit secret.
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  }

  return betterAuth({
    secret: secret ?? "dev-only-insecure-secret-do-not-use-in-production",
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: "/api/auth",

    database: drizzleAdapter(getDb(), { provider: "pg", schema: authSchema }),

    emailAndPassword: {
      enabled: true,
      /**
       * TEMPORARY, EXPLICIT, REVERSIBLE (2026-11-09).
       *
       * BUILD-PROMPT §12.A requires "the user can verify their email", and §3.A
       * step 4 places verification in the merchant journey. No email provider is
       * connected (CranL Email reports connected:false and can only be connected
       * by the owner from the dashboard), so that step cannot be completed yet.
       *
       * The default stays TRUE (secure). It is only relaxed when a deployment
       * sets EMAIL_VERIFICATION_REQUIRED=false — recorded in docs/evidence and
       * to be reverted as soon as the provider is live.
       */
      requireEmailVerification: process.env.EMAIL_VERIFICATION_REQUIRED !== "false",
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
       * Better Auth defaults to random STRING ids (e.g. rXL1pyAqdDzNxsQDj1kKQIWrmkQ0AXfV).
       * Our profile table `users.id` is a uuid — required by directive §3
       * ("UUID Primary Keys") — so lookups failed on type. Forcing uuid
       * generation keeps every primary key a real UUID and lets the identity
       * and its profile row share one id.
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
}

let cached: ReturnType<typeof createAuth> | null = null;

/** Constructed on first use, never at import time. */
export function getAuth(): ReturnType<typeof createAuth> {
  if (!cached) cached = createAuth();
  return cached;
}

export type Auth = ReturnType<typeof createAuth>;
