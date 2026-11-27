import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Tables owned by the warehouses module. Table names start with the module name.
export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  // The card that card-to-card payments for this warehouse's goods go to (customer notes, note 1).
  cardNumber: text("card_number").notNull(),
  // The name on that card, shown to shoppers who pay card-to-card (#19). Not always the owner.
  cardHolder: text("card_holder").notNull().default(""),
  // Profit added on top of the purchase price, in basis points (1000 = 10%). Integer: no floats in money.
  profitBp: integer("profit_bp").notNull().default(0),
  // What this warehouse's Excel stock sheet changes (#2): stock and prices, or only stock.
  sheetMode: text("sheet_mode", { enum: ["stock_and_price", "stock_only"] }).notNull().default("stock_and_price"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Warehouse = typeof warehouses.$inferSelect;
