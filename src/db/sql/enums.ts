import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Enumerations — spec §6 (data model).
 * Kept in one file so the allowed value sets are reviewable in a single place.
 */

export const merchantStatusEnum = pgEnum("merchant_status", [
  "active",
  "suspended",
]);

export const userRoleEnum = pgEnum("user_role", [
  "merchant_owner",
  "staff",
  "super_admin",
]);

export const cardModeEnum = pgEnum("card_mode", ["points", "stamps"]);

export const cardStatusEnum = pgEnum("card_status", ["draft", "published"]);

/** Transactions are append-only; `undo` is a compensating row, never an edit. */
export const transactionTypeEnum = pgEnum("transaction_type", [
  "earn",
  "redeem",
  "adjust",
  "undo",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const pushPlatformEnum = pgEnum("push_platform", ["apple", "google"]);

export const pushStatusEnum = pgEnum("push_status", [
  "pending",
  "sent",
  "failed",
  "dead",
]);

export const planCodeEnum = pgEnum("plan_code", ["free", "basic", "pro"]);
