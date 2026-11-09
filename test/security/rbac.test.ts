/**
 * test/security/rbac.test.ts — authorization policy (W2.6)
 *
 * Pure unit tests: no database, no session, no network. The policy layer is
 * where "staff cannot read analytics" must be true, so it is tested directly
 * rather than inferred from a hidden UI element.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  authorize,
  can,
  roleRequiresMfa,
  AuthorizationError,
  type UserRole,
} from "../../src/identity/rbac.ts";
import {
  toResolvedSession,
  SessionResolutionError,
} from "../../src/identity/session.ts";

const TENANT_A = "aaaaaaaa-0000-0000-0000-00000000000a";

test("can() denies by default for an unknown or absent role", () => {
  assert.equal(can(null, "analytics:read"), false);
  assert.equal(can(undefined, "analytics:read"), false);
  assert.equal(can("nonsense" as UserRole, "analytics:read"), false);
});

test("staff is restricted by capability, not by UI", () => {
  assert.equal(can("staff", "transaction:record"), true);
  assert.equal(can("staff", "reward:redeem"), true);
  assert.equal(can("staff", "transaction:undo"), true);
  // explicitly denied to staff (directive §2)
  assert.equal(can("staff", "analytics:read"), false);
  assert.equal(can("staff", "card:write"), false);
  assert.equal(can("staff", "customer:export"), false);
  assert.equal(can("staff", "staff:manage"), false);
  assert.equal(can("staff", "subscription:manage"), false);
});

test("merchant_owner gets the business capabilities", () => {
  for (const p of [
    "analytics:read",
    "card:write",
    "branch:write",
    "staff:manage",
    "customer:export",
    "subscription:manage",
  ] as const) {
    assert.equal(can("merchant_owner", p), true, `owner should hold ${p}`);
  }
});

test("platform permissions are not reachable from tenant roles", () => {
  for (const p of [
    "platform:merchants:suspend",
    "platform:audit:read",
    "platform:settings:write",
  ] as const) {
    assert.equal(can("merchant_owner", p), false, `owner must not hold ${p}`);
    assert.equal(can("staff", p), false, `staff must not hold ${p}`);
  }
});

test("only super_admin requires a second factor", () => {
  assert.equal(roleRequiresMfa("super_admin"), true);
  assert.equal(roleRequiresMfa("merchant_owner"), false);
  assert.equal(roleRequiresMfa("staff"), false);
});

test("authorize rejects an unauthenticated caller", () => {
  assert.throws(
    () =>
      authorize({ role: null, merchantId: TENANT_A, twoFactorEnabled: true, permission: "customer:read" }),
    (e: unknown) => e instanceof AuthorizationError && e.code === "unauthenticated",
  );
});

test("authorize refuses a tenant role with no tenant", () => {
  assert.throws(
    () =>
      authorize({
        role: "merchant_owner",
        merchantId: null,
        twoFactorEnabled: false,
        permission: "customer:read",
      }),
    (e: unknown) => e instanceof AuthorizationError && e.code === "unauthenticated",
  );
});

test("authorize enforces MFA for the super admin even when the permission is granted", () => {
  assert.throws(
    () =>
      authorize({
        role: "super_admin",
        merchantId: null,
        twoFactorEnabled: false, // role held, second factor missing
        permission: "platform:audit:read",
      }),
    (e: unknown) => e instanceof AuthorizationError && e.code === "mfa_required",
  );
});

test("authorize admits a super admin once MFA is satisfied", () => {
  assert.doesNotThrow(() =>
    authorize({
      role: "super_admin",
      merchantId: null,
      twoFactorEnabled: true,
      permission: "platform:audit:read",
    }),
  );
});

test("authorize rejects staff asking for an analytics permission", () => {
  assert.throws(
    () =>
      authorize({
        role: "staff",
        merchantId: TENANT_A,
        twoFactorEnabled: false,
        permission: "analytics:read",
      }),
    (e: unknown) => e instanceof AuthorizationError && e.code === "forbidden",
  );
});

test("toResolvedSession rejects an inactive account", () => {
  assert.throws(
    () =>
      toResolvedSession(
        { id: "u1", email: "a@b.test", twoFactorEnabled: false },
        { role: "merchant_owner", merchantId: TENANT_A, isActive: false },
      ),
    SessionResolutionError,
  );
});

test("toResolvedSession rejects a tenant role with no merchant", () => {
  assert.throws(
    () =>
      toResolvedSession(
        { id: "u1", email: "a@b.test", twoFactorEnabled: false },
        { role: "merchant_owner", merchantId: null, isActive: true },
      ),
    SessionResolutionError,
  );
});

test("toResolvedSession accepts a super admin with no merchant", () => {
  const s = toResolvedSession(
    { id: "u9", email: "root@taployal.test", twoFactorEnabled: true },
    { role: "super_admin", merchantId: null, isActive: true },
  );
  assert.equal(s.role, "super_admin");
  assert.equal(s.merchantId, null);
});

test("CANARY: session resolution cannot succeed without a profile row", () => {
  // If this ever passed, a logged-in identity with no profile would sail into
  // a tenant-scoped query with a null tenant.
  assert.throws(
    () => toResolvedSession({ id: "u1", email: "a@b.test", twoFactorEnabled: false }, null),
    SessionResolutionError,
  );
});
