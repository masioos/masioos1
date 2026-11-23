import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Shop-wide settings staff change in the admin, one row per key (e.g. support_phone).
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
