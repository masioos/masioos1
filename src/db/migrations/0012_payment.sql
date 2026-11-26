CREATE TABLE "requests_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"amount_toman" bigint NOT NULL,
	"payee_card" text NOT NULL,
	"payee_name" text NOT NULL,
	"tracking" text NOT NULL,
	"card_last4" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"delivery_method" text NOT NULL,
	"receipt_file" text,
	"verdict" text DEFAULT 'pending' NOT NULL,
	"verdict_reason" text DEFAULT '' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "card_holder" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "payee_card" text;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "payee_name" text;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "payment_form_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "delivery_method" text;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "shipping_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "refund_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD COLUMN "refund_tracking" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "requests_payments" ADD CONSTRAINT "requests_payments_request_id_requests_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_payments" ADD CONSTRAINT "requests_payments_decided_by_staff_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing warehouses: start with the owner's name on the card; the manager corrects it in /admin/warehouses.
UPDATE "warehouses" SET "card_holder" = "owner_name" WHERE "card_holder" = '';
