CREATE TYPE "public"."card_mode" AS ENUM('points', 'stamps');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."plan_code" AS ENUM('free', 'basic', 'pro');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('apple', 'google');--> statement-breakpoint
CREATE TYPE "public"."push_status" AS ENUM('pending', 'sent', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('earn', 'redeem', 'adjust', 'undo');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('merchant_owner', 'staff', 'super_admin');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"is_featured" boolean DEFAULT false NOT NULL,
	"location_priority" integer DEFAULT 0 NOT NULL,
	"location_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"default_language" text DEFAULT 'ar' NOT NULL,
	"country" text DEFAULT 'BH' NOT NULL,
	"timezone" text DEFAULT 'Asia/Bahrain' NOT NULL,
	"status" "merchant_status" DEFAULT 'active' NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"role" "user_role" DEFAULT 'merchant_owner' NOT NULL,
	"merchant_id" uuid,
	"pin_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apple_pass_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	"device_library_id" text NOT NULL,
	"push_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mode" "card_mode" DEFAULT 'stamps' NOT NULL,
	"stamps_required" integer,
	"stamp_icon" text,
	"points_per_unit" integer,
	"background_color" text,
	"foreground_color" text,
	"label_color" text,
	"logo_url" text,
	"strip_image_url" text,
	"terms_text" text,
	"location_notifications_enabled" boolean DEFAULT true NOT NULL,
	"nearby_message_ar" text,
	"nearby_message_en" text,
	"status" "card_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"joined_branch_id" uuid,
	"serial_number" text NOT NULL,
	"auth_token_hash" text NOT NULL,
	"web_view_token_hash" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"apple_status" text,
	"google_object_id" text,
	"last_updated_tag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"cost" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	"branch_id" uuid,
	"staff_user_id" uuid,
	"type" "transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"reward_id" uuid,
	"reverted_transaction_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"merchant_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount" numeric(10, 3) NOT NULL,
	"currency" text DEFAULT 'BHD' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"provider_invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "plan_code" NOT NULL,
	"price_monthly" numeric(10, 3) DEFAULT '0' NOT NULL,
	"max_customers" integer,
	"max_staff" integer,
	"max_branches" integer,
	"allows_broadcast" boolean DEFAULT false NOT NULL,
	"allows_location_notifications" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"pass_id" uuid NOT NULL,
	"platform" "push_platform" NOT NULL,
	"status" "push_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"current_period_end" timestamp with time zone,
	"payment_provider_customer_id" text,
	"payment_provider_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_pass_registrations" ADD CONSTRAINT "apple_pass_registrations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_pass_registrations" ADD CONSTRAINT "apple_pass_registrations_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_card_id_loyalty_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."loyalty_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_joined_branch_id_branches_id_fk" FOREIGN KEY ("joined_branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_card_id_loyalty_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."loyalty_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_jobs" ADD CONSTRAINT "push_jobs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_jobs" ADD CONSTRAINT "push_jobs_pass_id_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."passes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_merchant_id_idx" ON "branches" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "branches_merchant_featured_idx" ON "branches" USING btree ("merchant_id","is_featured");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_key" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merchants_owner_user_id_idx" ON "merchants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_merchant_id_idx" ON "users" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "apple_reg_device_pass_key" ON "apple_pass_registrations" USING btree ("device_library_id","pass_id");--> statement-breakpoint
CREATE INDEX "apple_reg_pass_id_idx" ON "apple_pass_registrations" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "apple_reg_merchant_id_idx" ON "apple_pass_registrations" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_merchant_phone_key" ON "customers" USING btree ("merchant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_merchant_id_idx" ON "customers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_cards_merchant_id_idx" ON "loyalty_cards" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "loyalty_cards_merchant_status_idx" ON "loyalty_cards" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "passes_serial_number_key" ON "passes" USING btree ("serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "passes_card_customer_key" ON "passes" USING btree ("card_id","customer_id");--> statement-breakpoint
CREATE INDEX "passes_merchant_id_idx" ON "passes" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "passes_customer_id_idx" ON "passes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "passes_card_id_idx" ON "passes" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemptions_transaction_key" ON "redemptions" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "redemptions_merchant_id_idx" ON "redemptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "rewards_merchant_id_idx" ON "rewards" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "rewards_card_id_idx" ON "rewards" USING btree ("card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "transactions_merchant_id_idx" ON "transactions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "transactions_pass_id_idx" ON "transactions" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "transactions_merchant_created_idx" ON "transactions" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_merchant_id_idx" ON "audit_logs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoices_merchant_id_idx" ON "invoices" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_provider_invoice_key" ON "invoices" USING btree ("provider_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_key" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "push_jobs_pass_id_idx" ON "push_jobs" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX "push_jobs_merchant_id_idx" ON "push_jobs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "push_jobs_status_idx" ON "push_jobs" USING btree ("status","attempts");--> statement-breakpoint
CREATE INDEX "subscriptions_merchant_id_idx" ON "subscriptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");