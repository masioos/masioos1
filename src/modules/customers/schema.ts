import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Tables owned by the customers module: shopper accounts and their sign-in sessions.
// Personal data (names, mobiles, addresses): never commit a dump of these tables.

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  // Normalized Iranian mobile "09xxxxxxxxx". The login name; one account per mobile.
  mobile: text("mobile").notNull().unique(),
  email: text("email"),
  // "scrypt:<salt hex>:<hash hex>" — see password.ts. Never logged, never sent to the browser.
  passwordHash: text("password_hash").notNull(),
  // The address of the last request, prefilled next time.
  lastAddress: text("last_address").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customersSessions = pgTable("customers_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  // sha256 of the random cookie value; the cookie itself is never stored.
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
