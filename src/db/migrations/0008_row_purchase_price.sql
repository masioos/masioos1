ALTER TABLE "requests_rows" ADD COLUMN "purchase_price_toman" bigint;--> statement-breakpoint
-- Existing rows: take the purchase price the product has today (the closest we have).
UPDATE "requests_rows" AS r SET "purchase_price_toman" = p."purchase_price_toman" FROM "catalog_products" AS p WHERE r."product_id" = p."id";
