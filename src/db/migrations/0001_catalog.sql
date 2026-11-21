CREATE TABLE "catalog_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "catalog_cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_cars_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "catalog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_categories_parent_name" UNIQUE NULLS NOT DISTINCT("parent_id","name")
);
--> statement-breakpoint
CREATE TABLE "catalog_countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_countries_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "catalog_part_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_part_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "catalog_product_cars" (
	"product_id" uuid NOT NULL,
	"car_id" uuid NOT NULL,
	CONSTRAINT "catalog_product_cars_product_id_car_id_pk" PRIMARY KEY("product_id","car_id")
);
--> statement-breakpoint
CREATE TABLE "catalog_product_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"brand_id" uuid,
	"category_id" uuid,
	"country_id" uuid,
	"part_group_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"purchase_price_toman" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_unavailable" boolean DEFAULT false NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "profit_bp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parent_id_catalog_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."catalog_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product_cars" ADD CONSTRAINT "catalog_product_cars_product_id_catalog_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product_cars" ADD CONSTRAINT "catalog_product_cars_car_id_catalog_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."catalog_cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product_photos" ADD CONSTRAINT "catalog_product_photos_product_id_catalog_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_brand_id_catalog_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."catalog_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_category_id_catalog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."catalog_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_country_id_catalog_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."catalog_countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_part_group_id_catalog_part_groups_id_fk" FOREIGN KEY ("part_group_id") REFERENCES "public"."catalog_part_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_products_warehouse_idx" ON "catalog_products" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "catalog_products_part_group_idx" ON "catalog_products" USING btree ("part_group_id");