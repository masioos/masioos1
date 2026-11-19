CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_name" text NOT NULL,
	"card_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
