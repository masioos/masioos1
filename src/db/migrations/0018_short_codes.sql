ALTER TABLE "warehouses" ADD COLUMN "code_prefix" text;--> statement-breakpoint
ALTER TABLE "catalog_cars" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD COLUMN "list_key" text;--> statement-breakpoint
CREATE INDEX "catalog_products_list_key_idx" ON "catalog_products" USING btree ("warehouse_id","list_key");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_code_prefix_unique" UNIQUE("code_prefix");--> statement-breakpoint
ALTER TABLE "catalog_cars" ADD CONSTRAINT "catalog_cars_short_code_unique" UNIQUE("short_code");