ALTER TABLE "warehouses" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Keep the order the list had before (newest first).
UPDATE "warehouses" SET "position" = o.n FROM (SELECT "id", row_number() OVER (ORDER BY "created_at" DESC) - 1 AS n FROM "warehouses") o WHERE "warehouses"."id" = o."id";
