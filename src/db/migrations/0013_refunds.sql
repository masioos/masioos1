CREATE TABLE "requests_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"amount_toman" bigint NOT NULL,
	"tracking" text NOT NULL,
	"receipt_file" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests_refunds" ADD CONSTRAINT "requests_refunds_request_id_requests_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_refunds" ADD CONSTRAINT "requests_refunds_created_by_staff_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;