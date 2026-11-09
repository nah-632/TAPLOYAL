import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  invoiceStatusEnum,
  planCodeEnum,
  pushPlatformEnum,
  pushStatusEnum,
  subscriptionStatusEnum,
} from "./enums";
import { merchants, users } from "./tenancy";
import { passes } from "./loyalty";

/**
 * Billing + operations — spec §6: plans, subscriptions, invoices, push_jobs,
 * audit_logs.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: planCodeEnum("code").notNull(),
    priceMonthly: numeric("price_monthly", { precision: 10, scale: 3 })
      .notNull()
      .default("0"),
    maxCustomers: integer("max_customers"),
    maxStaff: integer("max_staff"),
    maxBranches: integer("max_branches"),
    allowsBroadcast: boolean("allows_broadcast").notNull().default(false),
    /** false for free, true for basic and pro (spec §6). */
    allowsLocationNotifications: boolean("allows_location_notifications")
      .notNull()
      .default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("plans_code_key").on(t.code)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    paymentProviderCustomerId: text("payment_provider_customer_id"),
    paymentProviderSubscriptionId: text("payment_provider_subscription_id"),
    ...timestamps,
  },
  (t) => [
    index("subscriptions_merchant_id_idx").on(t.merchantId),
    index("subscriptions_status_idx").on(t.status),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 3 }).notNull(),
    currency: text("currency").notNull().default("BHD"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    providerInvoiceId: text("provider_invoice_id"),
    ...timestamps,
  },
  (t) => [
    index("invoices_merchant_id_idx").on(t.merchantId),
    index("invoices_subscription_id_idx").on(t.subscriptionId),
    uniqueIndex("invoices_provider_invoice_key").on(t.providerInvoiceId),
  ],
);

export const pushJobs = pgTable(
  "push_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    platform: pushPlatformEnum("platform").notNull(),
    status: pushStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    index("push_jobs_pass_id_idx").on(t.passId),
    index("push_jobs_merchant_id_idx").on(t.merchantId),
    index("push_jobs_status_idx").on(t.status, t.attempts),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** NULL for platform-level actions by a super admin. */
    merchantId: uuid("merchant_id").references(() => merchants.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity"),
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (t) => [
    index("audit_logs_merchant_id_idx").on(t.merchantId),
    index("audit_logs_actor_user_id_idx").on(t.actorUserId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);
