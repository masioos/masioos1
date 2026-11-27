CREATE TABLE "catalog_isaco_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" uuid,
	"file_rows" integer NOT NULL,
	"changed" integer NOT NULL,
	"unchanged" integer NOT NULL,
	"missing" integer NOT NULL,
	"no_price" integer NOT NULL,
	"waiting" integer NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "catalog_isaco_waiting" (
	"run_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"old_toman" bigint,
	"new_toman" bigint NOT NULL,
	CONSTRAINT "catalog_isaco_waiting_run_id_product_id_pk" PRIMARY KEY("run_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"old_toman" bigint,
	"new_toman" bigint,
	"source" text NOT NULL,
	"staff_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_isaco_runs" ADD CONSTRAINT "catalog_isaco_runs_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_isaco_waiting" ADD CONSTRAINT "catalog_isaco_waiting_run_id_catalog_isaco_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."catalog_isaco_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_isaco_waiting" ADD CONSTRAINT "catalog_isaco_waiting_product_id_catalog_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price_history" ADD CONSTRAINT "catalog_price_history_product_id_catalog_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price_history" ADD CONSTRAINT "catalog_price_history_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_price_history_product_idx" ON "catalog_price_history" USING btree ("product_id","at");