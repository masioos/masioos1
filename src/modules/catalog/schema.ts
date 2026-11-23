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
