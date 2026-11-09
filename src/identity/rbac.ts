/**
 * RBAC — directive §2 (roles) and §4 (MFA for the super admin).
 *
 * DIRECTORY NOTE: this lives in `src/identity/`, not `src/auth/`. `src/auth`
 * is un-creatable in this container (the name returns "File exists" while not
 * existing — a poisoned dentry). See docs/adr/ADR-001 §17.
 *
 * Design rules baked in here:
 *   - DENY BY DEFAULT. A permission not explicitly granted to a role is denied.
 *   - Staff are restricted by capability, never by "the UI hides the button".
 *   - The super-admin role additionally requires a satisfied second factor;
 *     holding the role is not sufficient.
 */

export type UserRole = "merchant_owner" | "staff" | "super_admin";

export const PERMISSIONS = [
  // merchant-owned capabilities
  "customer:read",
  "customer:write",
  "customer:export",
  "transaction:record",
  "transaction:undo",
  "reward:redeem",
  "card:read",
  "card:write",
  "branch:write",
  "staff:manage",
  "analytics:read",
  "subscription:manage",
  // platform capabilities
  "platform:merchants:read",
  "platform:merchants:suspend",
  "platform:audit:read",
  "platform:settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF: readonly Permission[] = [
  "customer:read",
  "transaction:record",
  "transaction:undo",
  "reward:redeem",
  "card:read",
];

const MERCHANT_OWNER: readonly Permission[] = [
  "customer:read",
  "customer:write",
  "customer:export",
  "transaction:record",
  "transaction:undo",
  "reward:redeem",
  "card:read",
  "card:write",
  "branch:write",
  "staff:manage",
  "analytics:read",
  "subscription:manage",
];

const SUPER_ADMIN: readonly Permission[] = [
  "platform:merchants:read",
  "platform:merchants:suspend",
  "platform:audit:read",
  "platform:settings:write",
];

const MATRIX: Record<UserRole, readonly Permission[]> = {
  staff: STAFF,
  merchant_owner: MERCHANT_OWNER,
  super_admin: SUPER_ADMIN,
};

/** The only role that must present a second factor (directive §2, §9). */
export const ROLES_REQUIRING_MFA: readonly UserRole[] = ["super_admin"];

export function roleRequiresMfa(role: UserRole): boolean {
  return ROLES_REQUIRING_MFA.includes(role);
}

/** Deny-by-default. Unknown role or unlisted permission => false. */
export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const granted = MATRIX[role];
  if (!granted) return false;
  return granted.includes(permission);
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "forbidden" | "mfa_required" = "forbidden",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * The single authorization gate used by every route/server action.
 * Checks, in order: authenticated -> tenant present (unless platform role)
 * -> MFA satisfied when the role demands it -> permission granted.
 */
export function authorize(input: {
  role: UserRole | null | undefined;
  merchantId: string | null | undefined;
  twoFactorEnabled: boolean;
  permission: Permission;
}): void {
  const { role, merchantId, twoFactorEnabled, permission } = input;

  if (!role) throw new AuthorizationError("no session", "unauthenticated");

  if (role !== "super_admin" && !merchantId) {
    // A tenant-scoped role with no tenant must never fall through to an
    // unscoped query.
    throw new AuthorizationError("session has no tenant", "unauthenticated");
  }

  if (roleRequiresMfa(role) && !twoFactorEnabled) {
    throw new AuthorizationError(
      `${role} must complete two-factor authentication`,
      "mfa_required",
    );
  }

  if (!can(role, permission)) {
    throw new AuthorizationError(`role ${role} lacks ${permission}`);
  }
}
