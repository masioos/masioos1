ALTER TABLE "warehouses" ADD COLUMN "sheet_mode" text DEFAULT 'stock_and_price' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD COLUMN "unavailable_source" text;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD COLUMN "from_sheet" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Goods made unavailable before #2 were made so by hand.
UPDATE "catalog_products" SET "unavailable_source" = 'hand' WHERE "is_unavailable" = true;
