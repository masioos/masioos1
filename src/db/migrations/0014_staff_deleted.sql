ALTER TABLE "staff_users" DROP CONSTRAINT "staff_users_mobile_unique";--> statement-breakpoint
ALTER TABLE "staff_users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_mobile_live" ON "staff_users" USING btree ("mobile") WHERE "staff_users"."deleted_at" is null;