ALTER TABLE "merchants" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "currency" text DEFAULT 'BHD' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "primary_color" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "secondary_color" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "contact_phone" text;