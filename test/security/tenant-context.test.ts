/**
 * test/security/tenant-context.test.ts — W3.1 / W3.2 unit tests
 *
 * Runs WITHOUT a database: the tenant layer's job is to decide what to send,
 * and a fake transaction lets us assert on exactly that. The database-side
 * behaviour of the emitted SQL is proven separately, against real PostgreSQL,
 * by test/security/isolation.test.mjs.
 *
 * The property under test is FAIL-CLOSED: a missing or malformed tenant context
 * must throw BEFORE any statement is issued — never degrade into an unscoped query.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  assertTenantContext,
  withTenant,
  MissingTenantContextError,
  type TenantTx,
} from "../../src/db/tenant.ts";

const TENANT_A = "aaaaaaaa-0000-0000-0000-00000000000a";
const TENANT_B = "bbbbbbbb-0000-0000-0000-00000000000b";

/** Records every statement the layer tries to run. */
function fakeDb() {
  const executed: unknown[] = [];
  let transactions = 0;
  const db = {
    async transaction<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T> {
      transactions += 1;
      return fn({
        async execute(q: unknown) {
          executed.push(q);
          return [];
        },
      });
    },
  };
  return {
    db,
    executed,
    get transactions() {
      return transactions;
    },
  };
}

/** Stable view of a drizzle SQL object for assertions (avoids private shapes). */
function dump(q: unknown): string {
  try {
    return JSON.stringify(q);
  } catch {
    return String(q);
  }
}

test("assertTenantContext rejects a missing session", () => {
  assert.throws(() => assertTenantContext(null), MissingTenantContextError);
  assert.throws(() => assertTenantContext(undefined), MissingTenantContextError);
});

test("assertTenantContext rejects a session with no merchant id", () => {
  assert.throws(
    () => assertTenantContext({ merchantId: null, userId: "u1", role: "merchant_owner" }),
    MissingTenantContextError,
  );
});

test("assertTenantContext rejects a non-uuid merchant id (no silent coercion)", () => {
  assert.throws(
    () => assertTenantContext({ merchantId: "1 OR 1=1", userId: "u1", role: "merchant_owner" }),
    MissingTenantContextError,
  );
});

test("assertTenantContext accepts a well-formed tenant session", () => {
  const out = assertTenantContext({
    merchantId: TENANT_A,
    userId: "u1",
    role: "merchant_owner",
  });
  assert.equal(out.merchantId, TENANT_A);
  assert.equal(out.isSuperAdmin, false);
});

test("withTenant scopes the transaction to the session's merchant id", async () => {
  const f = fakeDb();
  await withTenant(
    { merchantId: TENANT_A, userId: "u1", role: "merchant_owner" },
    async () => "ok",
    f.db,
  );
  assert.equal(f.transactions, 1);
  const stmt = dump(f.executed[0]);
  assert.ok(stmt.includes(TENANT_A), "app.merchant_id must be set to the session tenant");
  assert.ok(!stmt.includes(TENANT_B), "must never reference another tenant");
  assert.ok(
    !stmt.includes("app.is_super_admin"),
    "a merchant_owner must not receive super-admin context",
  );
});

test("withTenant grants super-admin context only for the super_admin role", async () => {
  const f = fakeDb();
  await withTenant({ merchantId: TENANT_A, userId: "admin1", role: "super_admin" }, async () => 1, f.db);
  const all = f.executed.map(dump).join("\n");
  assert.ok(all.includes("app.is_super_admin"), "super admin context must be set explicitly");
  assert.equal(f.executed.length, 2, "super admin path adds exactly one extra statement");
});

test("CANARY: a missing tenant context issues ZERO statements", async () => {
  const f = fakeDb();
  await assert.rejects(
    () => withTenant({ merchantId: null, userId: "u1", role: "merchant_owner" }, async () => 1, f.db),
    MissingTenantContextError,
  );
  assert.equal(f.transactions, 0, "no transaction may open without a tenant");
  assert.equal(f.executed.length, 0, "no statement may run without a tenant");
});
