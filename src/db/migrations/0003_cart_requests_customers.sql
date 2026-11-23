CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"mobile" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"last_address" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "customers_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "requests_cart_lines" (
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_cart_lines_cart_id_product_id_pk" PRIMARY KEY("cart_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "requests_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text,
	"customer_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_carts_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "requests_carts_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "requests_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'awaiting' NOT NULL,
	"address" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"reject_reason" text DEFAULT '' NOT NULL,
	"deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_seen_at" timestamp with time zone,
	"customer_notify_at" timestamp with time zone,
	"customer_seen_at" timestamp with time zone,
	CONSTRAINT "requests_requests_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "requests_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"product_id" uuid,
	"code" text,
	"name" text NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"warehouse_id" uuid,
	"quantity" integer NOT NULL,
	"price_toman" bigint,
	"is_unavailable" boolean DEFAULT false NOT NULL,
	"added_by_staff" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_cart_lines" ADD CONSTRAINT "requests_cart_lines_cart_id_requests_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."requests_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_cart_lines" ADD CONSTRAINT "requests_cart_lines_product_id_catalog_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_carts" ADD CONSTRAINT "requests_carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_messages" ADD CONSTRAINT "requests_messages_request_id_requests_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_requests" ADD CONSTRAINT "requests_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_rows" ADD CONSTRAINT "requests_rows_request_id_requests_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_rows" ADD CONSTRAINT "requests_rows_product_id_catalog_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests_rows" ADD CONSTRAINT "requests_rows_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;