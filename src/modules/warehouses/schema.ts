import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Tables owned by the warehouses module. Table names start with the module name.
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  // The card that card-to-card payments for this warehouse's goods go to (customer notes, note 1).
  cardNumber: text("card_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Warehouse = typeof warehouses.$inferSelect;
