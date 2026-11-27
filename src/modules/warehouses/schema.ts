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
  // Short English code, e.g. «RF» for رفیع نیا: the start of the codes the site makes for this
  // warehouse's price-list goods (#3), like «RF.PR.012».
  codePrefix: text("code_prefix").unique(),
  // Not used any more: the ISACO warehouse's stock sheet changes only stock, others stock and
  // price (catalog's `sheetModeFor`). Kept so no data is dropped; remove with a migration later.
  sheetMode: text("sheet_mode", { enum: ["stock_and_price", "stock_only"] }).notNull().default("stock_and_price"),
  // Place in the warehouses list (0 = first); the manager moves rows with ▲ ▼.
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Warehouse = typeof warehouses.$inferSelect;
