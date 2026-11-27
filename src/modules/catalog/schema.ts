import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { staffUsers } from "@/modules/staff/schema";
import { warehouses } from "@/modules/warehouses/schema";

// Tables owned by the catalog module. Every table name starts with "catalog_".
// The foreign key to warehouses is the one place this module names another module's table:
// a schema-level link only. Catalog never reads or writes the warehouses table itself.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const catalogCars = pgTable("catalog_cars", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const catalogBrands = pgTable("catalog_brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const catalogCountries = pgTable("catalog_countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

// Two levels are used (e.g. Suspension → Wheel bearing); the database does not enforce the depth.
export const catalogCategories = pgTable(
  "catalog_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => catalogCategories.id),
    createdAt: createdAt(),
  },
  (t) => [unique("catalog_categories_parent_name").on(t.parentId, t.name).nullsNotDistinct()],
);

// Same part, different brands (e.g. four «دیسک چرخ پژو 405»): shown as «مدل‌های دیگر این قطعه».
export const catalogPartGroups = pgTable("catalog_part_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: createdAt(),
});

export const catalogProducts = pgTable(
  "catalog_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    // Technical code, normalized (ASCII digits, no spaces/dashes). Unique across all warehouses.
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    brandId: uuid("brand_id").references(() => catalogBrands.id),
    categoryId: uuid("category_id").references(() => catalogCategories.id),
    countryId: uuid("country_id").references(() => catalogCountries.id),
    partGroupId: uuid("part_group_id").references(() => catalogPartGroups.id),
    description: text("description").notNull().default(""),
    // Staff-only. Whole Toman. null = no price («برای قیمت تماس بگیرید»).
    purchasePriceToman: bigint("purchase_price_toman", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    isUnavailable: boolean("is_unavailable").notNull().default(false),
    // Who made it «ناموجود» (#2): staff by hand, or a stock sheet it was missing from. A later
    // sheet makes only "sheet" goods available again. null while available.
    unavailableSource: text("unavailable_source", { enum: ["hand", "sheet"] }),
    // An Excel stock sheet created it or had its code (#2). Only these goods go «ناموجود» when
    // missing from a later sheet; goods made by hand and never in a sheet are left alone.
    fromSheet: boolean("from_sheet").notNull().default(false),
    // Sold per piece (عدد) or per pair (جفت). Prices are per unit.
    unit: text("unit", { enum: ["piece", "pair"] }).notNull().default("piece"),
    // normalizeSearch(name + code + brand). Written by the app on every save, so search is one ILIKE.
    searchText: text("search_text").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("catalog_products_warehouse_idx").on(t.warehouseId),
    index("catalog_products_part_group_idx").on(t.partGroupId),
  ],
);

export const catalogProductCars = pgTable(
  "catalog_product_cars",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => catalogProducts.id, { onDelete: "cascade" }),
    carId: uuid("car_id")
      .notNull()
      .references(() => catalogCars.id),
  },
  (t) => [primaryKey({ columns: [t.productId, t.carId] })],
);

export const catalogProductPhotos = pgTable("catalog_product_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => catalogProducts.id, { onDelete: "cascade" }),
  // "<uuid>.<jpg|png|webp>" under UPLOAD_DIR. Served by /media/<fileName>.
  fileName: text("file_name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export type Product = typeof catalogProducts.$inferSelect;

// ── Purchase prices over time (#8) ──

/** Every purchase-price change of a product: by hand, from the stock sheet, or from ISACO's file. */
export const catalogPriceHistory = pgTable(
  "catalog_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => catalogProducts.id, { onDelete: "cascade" }),
    oldToman: bigint("old_toman", { mode: "number" }),
    newToman: bigint("new_toman", { mode: "number" }),
    source: text("source", { enum: ["hand", "sheet", "isaco"] }).notNull(),
    // Who uploaded or typed it. Schema-level link only, like the warehouses one.
    staffId: uuid("staff_id").references(() => staffUsers.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("catalog_price_history_product_idx").on(t.productId, t.at)],
);

/** One upload of ISACO's full price file and what it did. */
export const catalogIsacoRuns = pgTable("catalog_isaco_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  staffId: uuid("staff_id").references(() => staffUsers.id),
  fileRows: integer("file_rows").notNull(),
  changed: integer("changed").notNull(),
  unchanged: integer("unchanged").notNull(),
  // Our goods not in the file, and goods whose file price is 0 / empty: their price is kept.
  missing: integer("missing").notNull(),
  noPrice: integer("no_price").notNull(),
  // Big jumps waiting for the manager's «تأیید» (more than 50 goods moving over 30%).
  waiting: integer("waiting").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

/** Big price jumps of the newest run, applied only after «تأیید». */
export const catalogIsacoWaiting = pgTable(
  "catalog_isaco_waiting",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => catalogIsacoRuns.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => catalogProducts.id, { onDelete: "cascade" }),
    oldToman: bigint("old_toman", { mode: "number" }),
    newToman: bigint("new_toman", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.productId] })],
);
