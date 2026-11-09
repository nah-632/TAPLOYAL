import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { merchantStatusEnum, userRoleEnum } from "./enums";

/**
 * Tenancy core — spec §6: Merchants, Users, Branches.
 *
 * Contracts enforced here (re-check before every migration):
 *  - every table: id uuid pk, created_at, updated_at
 *  - every tenant-owned table: merchant_id NOT NULL + indexed
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    defaultLanguage: text("default_language").notNull().default("ar"),
    country: text("country").notNull().default("BH"),
    timezone: text("timezone").notNull().default("Asia/Bahrain"),
    status: merchantStatusEnum("status").notNull().default("active"),
    ownerUserId: uuid("owner_user_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("merchants_slug_key").on(t.slug),
    index("merchants_owner_user_id_idx").on(t.ownerUserId),
    index("merchants_status_idx").on(t.status),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    role: userRoleEnum("role").notNull().default("merchant_owner"),
    /** NULL for super_admin (spec §6). */
    merchantId: uuid("merchant_id").references(() => merchants.id, {
      onDelete: "cascade",
    }),
    /** Staff PIN — stored only as a hash, verified server-side (ADR-004). */
    pinHash: text("pin_hash"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    index("users_merchant_id_idx").on(t.merchantId),
    index("users_role_idx").on(t.role),
  ],
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    /** Validated -90..90 / -180..180, and (0,0) rejected (spec §8.5.8). */
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    isFeatured: boolean("is_featured").notNull().default(false),
    locationPriority: integer("location_priority").notNull().default(0),
    locationEnabled: boolean("location_enabled").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("branches_merchant_id_idx").on(t.merchantId),
    index("branches_merchant_featured_idx").on(t.merchantId, t.isFeatured),
  ],
);
