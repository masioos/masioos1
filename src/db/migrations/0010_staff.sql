CREATE TABLE "requests_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"mobile" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"can_see_purchase_price" boolean DEFAULT false NOT NULL,
	"can_see_profit" boolean DEFAULT false NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"last_sign_out_at" timestamp with time zone,
	"last_action" text DEFAULT '' NOT NULL,
	"last_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_users_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
ALTER TABLE "requests_history" ADD CONSTRAINT "requests_history_request_id_requests_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_history" ADD CONSTRAINT "requests_history_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requests_history_request_idx" ON "requests_history" USING btree ("request_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_history_one_edit_idx" ON "requests_history" USING btree ("request_id","staff_id") WHERE "requests_history"."kind" = 'edit';