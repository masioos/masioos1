ALTER TABLE "requests_requests" ADD COLUMN "discount_kind" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "discount_value" bigint DEFAULT 0 NOT NULL;