/**
 * test/integration/auth.test.ts — real end-to-end authentication
 *
 * Talks to the actual CranL PostgreSQL through the actual Better Auth instance.
 * This is the only test that can legitimately claim "sign-in works".
 *
 * Everything lives under ONE top-level test with sequential subtests: parallel
 * execution previously let the cleanup step delete the identity before the
 * assertions that needed it, which produced a confusing false failure.
 *
 * Prerequisite: .env.local with DATABASE_URL for the RESTRICTED role
 * (`taployal_app`, NOBYPASSRLS) — see tools/provision-app-role.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Run: sh tools/run-integration-tests.sh " +
      "(it sources .env.local; generate it with tools/provision-app-role.mjs)",
  );
}

const { auth } = await import("../../src/identity/better-auth.ts");
const { default: postgres } = await import("postgres");
const { resolveSession } = await import("../../src/identity/session.ts");
const { getDb } = await import("../../src/db/client.ts");

const PASSWORD = "CorrectHorseBatteryStaple9";
const email = `auth-test-${randomBytes(4).toString("hex")}@taployal.test`;

function sql() {
  return postgres(process.env.DATABASE_URL!, { max: 2, prepare: false });
}
async function withDb<T>(fn: (db: ReturnType<typeof sql>) => Promise<T>): Promise<T> {
  const db = sql();
  try {
    return await fn(db);
  } finally {
    await db.end({ timeout: 5 });
  }
}

let authUserId = "";

test("authentication end-to-end", async (t) => {
  await t.test("the runtime connects as the restricted role (RLS cannot be bypassed)", async () => {
    await withDb(async (db) => {
      const rows = await db`select current_user as usr, rolsuper as s, rolbypassrls as b
                            from pg_roles where rolname = current_user`;
      assert.equal(rows[0]!.usr, "taployal_app");
      assert.equal(rows[0]!.s, false);
      assert.equal(rows[0]!.b, false);
    });
  });

  await t.test("sign-up stores the password as Argon2id, never in plaintext", async () => {
    const res = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: "Auth Test" },
    });
    assert.ok(res?.user?.id, "sign-up must return a user id");
    authUserId = res.user.id;

    await withDb(async (db) => {
      const rows = await db`select password from account where user_id = ${authUserId}`;
      assert.equal(rows.length, 1, "exactly one credential row");
      const stored = rows[0]!.password as string;
      assert.ok(stored.startsWith("$argon2id$"), `expected argon2id, got ${stored.slice(0, 12)}`);
      assert.ok(!stored.includes(PASSWORD), "plaintext password must never be stored");
      assert.match(stored, /\$v=19\$m=19456,t=2,p=1\$/, "OWASP baseline parameters");
    });
  });

  await t.test("sign-in is refused until the email is verified", async () => {
    await assert.rejects(
      () => auth.api.signInEmail({ body: { email, password: PASSWORD } }),
      /verif/i,
      "an unverified account must not be able to sign in",
    );
  });

  await t.test("wrong password is refused", async () => {
    await withDb(async (db) => {
      await db`update "user" set email_verified = true where email = ${email}`;
    });
    await assert.rejects(
      () => auth.api.signInEmail({ body: { email, password: "wrong-password-123" } }),
      /invalid|password/i,
    );
  });

  await t.test("correct credentials create a session that resolves server-side", async () => {
    const res = (await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    })) as unknown as { headers?: Headers; response?: { token?: string }; token?: string };

    assert.ok(res?.response?.token || res?.token, "sign-in must return a session token");

    const setCookie = res?.headers?.get?.("set-cookie") ?? "";
    assert.ok(setCookie.length > 0, "sign-in must set a session cookie");
    assert.match(setCookie, /HttpOnly/i, "session cookie must be HttpOnly");

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: setCookie.split(";")[0]! }),
    });
    assert.ok(session?.session?.id, "the session must be resolvable from the cookie");
    assert.equal(session?.user?.email, email);

    await withDb(async (db) => {
      const rows = await db`select count(*)::int as n from session s
                            join "user" u on u.id = s.user_id where u.email = ${email}`;
      assert.equal(rows[0]!.n, 1, "a real session row must exist, not just a signed cookie");
    });
  });

  await t.test("CANARY: a signed-in identity with no profile row cannot resolve a tenant", async () => {
    const rows = await withDb(async (db) => {
      return await db`select id, email from "user" where id = ${authUserId}`;
    });
    assert.equal(rows.length, 1, "the identity created by this run must still exist");

    await assert.rejects(
      () =>
        resolveSession(
          { id: rows[0]!.id as string, email: rows[0]!.email as string, twoFactorEnabled: false },
          getDb(),
        ),
      /no profile row/,
      "an authenticated user without a profile must not reach tenant data",
    );
  });

  await t.test("cleanup", async () => {
    await withDb(async (db) => {
      await db`delete from session where user_id = ${authUserId}`;
      await db`delete from account where user_id = ${authUserId}`;
      await db`delete from "user" where id = ${authUserId}`;
      const rows = await db`select count(*)::int as n from "user" where id = ${authUserId}`;
      assert.equal(rows[0]!.n, 0);
    });
  });
});
