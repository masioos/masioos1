import { bigint, boolean, integer, pgTable, primaryKey, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { catalogProducts } from "@/modules/catalog/schema";
import { customers } from "@/modules/customers/schema";
import { warehouses } from "@/modules/warehouses/schema";

// Tables owned by the requests module: the cart, and requests staff confirm (#5).
// Foreign keys to other modules' tables are schema-level links only (ARCHITECTURE.md § Boundaries).

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** One cart per browser (cookie `anb_cart`) and, once signed in, one per shopper. */
export const requestsCarts = pgTable("requests_carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // sha256 of the cookie value; null for a cart that only belongs to a shopper.
  tokenHash: text("token_hash").unique(),
  customerId: uuid("customer_id")
    .unique()
    .references(() => customers.id, { onDelete: "cascade" }),
  // Free text: goods not in the shop, or more than the quantity limit.
  note: text("note").notNull().default(""),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const requestsCartLines = pgTable(
  "requests_cart_lines",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => requestsCarts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => catalogProducts.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    addedAt: ts("added_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.productId] })],
);

export const requestStatuses = ["awaiting", "confirmed", "accepted", "cancelled", "rejected", "declined"] as const;

export const requestsRequests = pgTable("requests_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Shown to people: «درخواست ۱۲».
  number: serial("number").notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  // "expired" is not stored: confirmed + deadline passed (rules.effectiveStatus).
  status: text("status", { enum: requestStatuses }).notNull().default("awaiting"),
  address: text("address").notNull(),
  note: text("note").notNull().default(""),
  rejectReason: text("reject_reason").notNull().default(""),
  deadlineAt: ts("deadline_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  // Staff opened it after the last shopper change (new / cancelled / answered).
  staffSeenAt: ts("staff_seen_at"),
  // Shopper attention: a header marker while customerSeenAt < customerNotifyAt.
  customerNotifyAt: ts("customer_notify_at"),
  customerSeenAt: ts("customer_seen_at"),
  // A shopper message staff have not read yet (its own alert sound).
  staffUnreadMessageAt: ts("staff_unread_message_at"),
  // Discount on the whole invoice (rules.invoiceTotals): a percent 0–100 or an amount in Toman.
  discountKind: text("discount_kind", { enum: ["none", "percent", "amount"] }).notNull().default("none"),
  discountValue: bigint("discount_value", { mode: "number" }).notNull().default(0),
});

export const requestsRows = pgTable("requests_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requestsRequests.id, { onDelete: "cascade" }),
  // null for a free row staff typed (no catalog product).
  productId: uuid("product_id").references(() => catalogProducts.id, { onDelete: "set null" }),
  code: text("code"),
  name: text("name").notNull(),
  unit: text("unit", { enum: ["piece", "pair"] }).notNull().default("piece"),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  quantity: integer("quantity").notNull(),
  // Shop price per unit, whole Toman. null = still unknown («برای قیمت تماس بگیرید»).
  priceToman: bigint("price_toman", { mode: "number" }),
  isUnavailable: boolean("is_unavailable").notNull().default(false),
  // Staff discount on this row, whole percent 0–100 (rules.rowTotal).
  discountPercent: integer("discount_percent").notNull().default(0),
  addedByStaff: boolean("added_by_staff").notNull().default(false),
  position: integer("position").notNull().default(0),
});

/** Messages on a request: staff → shopper, and shopper → staff (fromShopper). */
export const requestsMessages = pgTable("requests_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requestsRequests.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  fromShopper: boolean("from_shopper").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type RequestRow = typeof requestsRows.$inferSelect;
export type RequestRecord = typeof requestsRequests.$inferSelect;
