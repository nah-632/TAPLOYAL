import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { cardModeEnum, cardStatusEnum, transactionTypeEnum } from "./enums";
import { branches, merchants, users } from "./tenancy";

/**
 * Loyalty domain — spec §6: loyalty_cards, customers, passes,
 * apple_pass_registrations, transactions, rewards, redemptions.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const loyaltyCards = pgTable(
  "loyalty_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mode: cardModeEnum("mode").notNull().default("stamps"),
    stampsRequired: integer("stamps_required"),
    /** Key from the stamp icon library (spec §10.6). */
    stampIcon: text("stamp_icon"),
    pointsPerUnit: integer("points_per_unit"),
    backgroundColor: text("background_color"),
    foregroundColor: text("foreground_color"),
    labelColor: text("label_color"),
    logoUrl: text("logo_url"),
    stripImageUrl: text("strip_image_url"),
    termsText: text("terms_text"),
    locationNotificationsEnabled: boolean("location_notifications_enabled")
      .notNull()
      .default(true),
    /** Max 80 characters — enforced in the write path and by a CHECK constraint. */
    nearbyMessageAr: text("nearby_message_ar"),
    nearbyMessageEn: text("nearby_message_en"),
    status: cardStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [
    index("loyalty_cards_merchant_id_idx").on(t.merchantId),
    index("loyalty_cards_merchant_status_idx").on(t.merchantId, t.status),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    /** Explicit consent captured at join (spec §9). */
    consentAt: timestamp("consent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // A duplicate phone for the same merchant must NOT create a second card.
    uniqueIndex("customers_merchant_phone_key").on(t.merchantId, t.phone),
    index("customers_merchant_id_idx").on(t.merchantId),
  ],
);

export const passes = pgTable(
  "passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => loyaltyCards.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    joinedBranchId: uuid("joined_branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    /** Unique, long, random, unguessable — the ONLY thing the barcode carries. */
    serialNumber: text("serial_number").notNull(),
    /** Hashes only — never the plaintext token (spec §9). */
    authTokenHash: text("auth_token_hash").notNull(),
    webViewTokenHash: text("web_view_token_hash").notNull(),
    balance: integer("balance").notNull().default(0),
    appleStatus: text("apple_status"),
    googleObjectId: text("google_object_id"),
    lastUpdatedTag: text("last_updated_tag"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("passes_serial_number_key").on(t.serialNumber),
    uniqueIndex("passes_card_customer_key").on(t.cardId, t.customerId),
    index("passes_merchant_id_idx").on(t.merchantId),
    index("passes_customer_id_idx").on(t.customerId),
    index("passes_card_id_idx").on(t.cardId),
  ],
);

export const applePassRegistrations = pgTable(
  "apple_pass_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    deviceLibraryId: text("device_library_id").notNull(),
    pushToken: text("push_token").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("apple_reg_device_pass_key").on(t.deviceLibraryId, t.passId),
    index("apple_reg_pass_id_idx").on(t.passId),
    index("apple_reg_merchant_id_idx").on(t.merchantId),
  ],
);

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => loyaltyCards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    cost: integer("cost").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("rewards_merchant_id_idx").on(t.merchantId),
    index("rewards_card_id_idx").on(t.cardId),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    staffUserId: uuid("staff_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: transactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    rewardId: uuid("reward_id").references(() => rewards.id, {
      onDelete: "set null",
    }),
    /** Self-reference: an `undo` row points at the row it reverses. */
    revertedTransactionId: uuid("reverted_transaction_id"),
    /** UNIQUE — what makes a double-tap record one transaction (spec §11). */
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("transactions_idempotency_key_key").on(t.idempotencyKey),
    index("transactions_merchant_id_idx").on(t.merchantId),
    index("transactions_pass_id_idx").on(t.passId),
    index("transactions_merchant_created_idx").on(t.merchantId, t.createdAt),
  ],
);

export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "restrict" }),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("redemptions_transaction_key").on(t.transactionId),
    index("redemptions_merchant_id_idx").on(t.merchantId),
  ],
);
