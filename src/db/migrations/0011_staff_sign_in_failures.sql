CREATE TABLE "staff_sign_in_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mobile" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "staff_sign_in_failures_mobile_idx" ON "staff_sign_in_failures" USING btree ("mobile","at");