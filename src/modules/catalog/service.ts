import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/env";
import { getWarehouseProfits, listWarehouses } from "@/modules/warehouses";
import {
  buildSearchText,
  detectImageType,
  isSafePhotoName,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PRODUCT,
  normalizeCode,
  PHOTO_CONTENT_TYPES,
  searchWords,
  shopPriceToman,
  type ListItemInput,
  type ListKind,
  type ProductInput,
  type StockRow,
  type Unit,
} from "./rules";
import {
  catalogBrands,
  catalogCars,
  catalogCategories,
  catalogCountries,
  catalogPartGroups,
  catalogProductCars,
  catalogProductPhotos,
  catalogProducts,
} from "./schema";

// Server-side use cases of the catalog module. Only this module touches the catalog_* tables.
// Shop reads never return the purchase price, the profit or the warehouse.

export const PAGE_SIZE = 24;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Postgres "unique violation" (23505), also when Drizzle wraps the driver error. */
function uniqueViolation(e: unknown): string | null {
  return pgError(e, "23505");
}

function pgError(e: unknown, wanted: string): string | null {
  for (let err = e; err && typeof err === "object"; err = (err as { cause?: unknown }).cause) {
    const { code, constraint_name } = err as { code?: string; constraint_name?: string };
    if (code === wanted) return constraint_name ?? "";
  }
  return null;
}

/** Postgres "foreign key violation" (23503): a chosen warehouse, car, brand ... no longer exists. */
function missingReference(e: unknown): boolean {
  return pgError(e, "23503") !== null;
}

const MISSING = "اطلاعات انتخاب‌شده پیدا نشد. صفحه را دوباره باز کنید.";

/** For ILIKE: a literal %, _ or \ typed by a shopper must not act as a wildcard. */
function likeContains(word: string): string {
  return `%${word.replace(/[\\%_]/g, "\\$&")}%`;
}

// ── Lists: cars, brands, countries, categories, part groups ───────────────────────────

const listTables = {
  cars: catalogCars,
  brands: catalogBrands,
  countries: catalogCountries,
  partGroups: catalogPartGroups,
} as const;

export type ListItem = { id: string; name: string; parentId?: string | null };

export async function listItems(kind: ListKind): Promise<ListItem[]> {
  if (kind === "categories") {
    return db
      .select({ id: catalogCategories.id, name: catalogCategories.name, parentId: catalogCategories.parentId })
      .from(catalogCategories)
      .orderBy(asc(catalogCategories.name));
  }
  const t = listTables[kind];
  return db.select({ id: t.id, name: t.name }).from(t).orderBy(asc(t.name));
}

/** Creates (no id) or renames (with id) one list item. Same name twice → friendly error. */
export async function saveListItem(input: ListItemInput): Promise<Result> {
  try {
    if (input.kind === "categories") {
      if (input.id && input.id === input.parentId) {
        return { ok: false, error: "یک دسته نمی‌تواند زیرمجموعه‌ی خودش باشد" };
      }
      // Two levels only: the parent must be a main category, and a main category with
      // sub-categories cannot itself become a sub-category.
      if (input.parentId) {
        const [parent] = await db
          .select({ parentId: catalogCategories.parentId })
          .from(catalogCategories)
          .where(eq(catalogCategories.id, input.parentId));
        if (!parent) return { ok: false, error: MISSING };
        if (parent.parentId) return { ok: false, error: "دسته فقط دو سطح دارد: دسته‌ی اصلی و زیرمجموعه" };
        if (input.id) {
          const [child] = await db
            .select({ id: catalogCategories.id })
            .from(catalogCategories)
            .where(eq(catalogCategories.parentId, input.id))
            .limit(1);
          if (child) {
            return { ok: false, error: "این دسته زیرمجموعه دارد و نمی‌تواند زیرمجموعه‌ی دسته‌ی دیگری شود" };
          }
        }
      }
      const values = { name: input.name, parentId: input.parentId };
      if (input.id) await db.update(catalogCategories).set(values).where(eq(catalogCategories.id, input.id));
      else await db.insert(catalogCategories).values(values);
      return { ok: true };
    }
    const t = listTables[input.kind];
    if (!input.id) {
      await db.insert(t).values({ name: input.name });
      return { ok: true };
    }
    await db.transaction(async (tx) => {
      await tx.update(t).set({ name: input.name }).where(eq(t.id, input.id!));
      // A brand's name is part of each product's search text.
      if (input.kind === "brands") {
        const rows = await tx
          .select({ id: catalogProducts.id, name: catalogProducts.name, code: catalogProducts.code })
          .from(catalogProducts)
          .where(eq(catalogProducts.brandId, input.id!));
        for (const p of rows) {
          await tx
            .update(catalogProducts)
            .set({ searchText: buildSearchText(p.name, p.code, input.name) })
            .where(eq(catalogProducts.id, p.id));
        }
      }
    });
    return { ok: true };
  } catch (e) {
    if (uniqueViolation(e) !== null) return { ok: false, error: "این نام قبلاً ثبت شده است" };
    if (missingReference(e)) return { ok: false, error: MISSING };
    throw e;
  }
}

// ── Products (admin) ───────────────────────────────────────────────────────────────────

async function brandName(brandId: string | null): Promise<string | null> {
  if (!brandId) return null;
  const [b] = await db.select({ name: catalogBrands.name }).from(catalogBrands).where(eq(catalogBrands.id, brandId));
  return b?.name ?? null;
}

function productValues(input: ProductInput, brand: string | null) {
  return {
    warehouseId: input.warehouseId,
    code: input.code,
    name: input.name,
    brandId: input.brandId,
    categoryId: input.categoryId,
    countryId: input.countryId,
    partGroupId: input.partGroupId,
    description: input.description,
    unit: input.unit,
    purchasePriceToman: input.purchasePriceToman,
    searchText: buildSearchText(input.name, input.code, brand),
  };
}

const DUPLICATE_CODE = "این کد فنی قبلاً ثبت شده است";

export async function createProduct(input: ProductInput): Promise<Result<{ id: string }>> {
  const brand = await brandName(input.brandId);
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(catalogProducts)
        .values(productValues(input, brand))
        .returning({ id: catalogProducts.id });
      if (input.carIds.length > 0) {
        await tx.insert(catalogProductCars).values(input.carIds.map((carId) => ({ productId: row.id, carId })));
      }
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (uniqueViolation(e) !== null) return { ok: false, error: DUPLICATE_CODE };
    if (missingReference(e)) return { ok: false, error: MISSING };
    throw e;
  }
}

export async function updateProduct(id: string, input: ProductInput): Promise<Result> {
  const brand = await brandName(input.brandId);
  try {
    const found = await db.transaction(async (tx) => {
      const updated = await tx
        .update(catalogProducts)
        .set({ ...productValues(input, brand), updatedAt: new Date() })
        .where(eq(catalogProducts.id, id))
        .returning({ id: catalogProducts.id });
      if (updated.length === 0) return false;
      await tx.delete(catalogProductCars).where(eq(catalogProductCars.productId, id));
      if (input.carIds.length > 0) {
        await tx.insert(catalogProductCars).values(input.carIds.map((carId) => ({ productId: id, carId })));
      }
      return true;
    });
    return found ? { ok: true } : { ok: false, error: "کالا پیدا نشد" };
  } catch (e) {
    if (uniqueViolation(e) !== null) return { ok: false, error: DUPLICATE_CODE };
    if (missingReference(e)) return { ok: false, error: MISSING };
    throw e;
  }
}

export async function setProductFlag(id: string, flag: "isActive" | "isUnavailable", value: boolean) {
  await db
    .update(catalogProducts)
    .set({ [flag]: value, updatedAt: new Date() })
    .where(eq(catalogProducts.id, id));
}

export async function getProductForEdit(id: string) {
  const [product] = await db.select().from(catalogProducts).where(eq(catalogProducts.id, id));
  if (!product) return null;
  const [cars, photos] = await Promise.all([
    db.select({ carId: catalogProductCars.carId }).from(catalogProductCars).where(eq(catalogProductCars.productId, id)),
    listPhotos(id),
  ]);
  return { product, carIds: cars.map((c) => c.carId), photos };
}

export type AdminProductRow = {
  id: string;
  code: string;
  name: string;
  warehouseName: string;
  brandName: string | null;
  purchasePriceToman: number | null;
  shopPriceToman: number | null;
  isActive: boolean;
  isUnavailable: boolean;
};

export async function listProductsAdmin(opts: { q?: string; warehouseId?: string; page: number }) {
  const where: SQL[] = [];
  for (const w of searchWords(opts.q ?? "")) where.push(ilike(catalogProducts.searchText, likeContains(w)));
  if (opts.warehouseId) where.push(eq(catalogProducts.warehouseId, opts.warehouseId));
  const cond = where.length ? and(...where) : undefined;

  const [rows, [{ total }], warehouses] = await Promise.all([
    db
      .select({
        id: catalogProducts.id,
        code: catalogProducts.code,
        name: catalogProducts.name,
        warehouseId: catalogProducts.warehouseId,
        brandName: catalogBrands.name,
        purchasePriceToman: catalogProducts.purchasePriceToman,
        isActive: catalogProducts.isActive,
        isUnavailable: catalogProducts.isUnavailable,
      })
      .from(catalogProducts)
      .leftJoin(catalogBrands, eq(catalogBrands.id, catalogProducts.brandId))
      .where(cond)
      .orderBy(desc(catalogProducts.updatedAt), asc(catalogProducts.code))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(catalogProducts).where(cond),
    listWarehouses(),
  ]);
  const byId = new Map(warehouses.map((w) => [w.id, w]));
  const items: AdminProductRow[] = rows.map(({ warehouseId, ...r }) => ({
    ...r,
    warehouseName: byId.get(warehouseId)?.name ?? "",
    shopPriceToman: shopPriceToman(r.purchasePriceToman, byId.get(warehouseId)?.profitBp ?? 0),
  }));
  return { items, total };
}

// ── Photos ─────────────────────────────────────────────────────────────────────────────

// UPLOAD_DIR is runtime data, not source code: tell the bundler not to trace (copy) that folder.
function uploadDir() {
  return path.resolve(/*turbopackIgnore: true*/ env.UPLOAD_DIR);
}

export async function listPhotos(productId: string) {
  return db
    .select({ id: catalogProductPhotos.id, fileName: catalogProductPhotos.fileName })
    .from(catalogProductPhotos)
    .where(eq(catalogProductPhotos.productId, productId))
    .orderBy(asc(catalogProductPhotos.position), asc(catalogProductPhotos.createdAt));
}

export async function addPhoto(productId: string, file: File): Promise<Result> {
  if (file.size === 0) return { ok: false, error: "فایلی انتخاب نشده است" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "حجم عکس باید کمتر از ۵ مگابایت باشد" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "فقط عکس JPG، PNG یا WEBP قبول می‌شود" };
  const fileName = `${randomUUID()}.${type}`;

  // Row first, under a lock on the product, so two quick uploads cannot pass the limit of 6
  // and a missing product never leaves a stray file on disk.
  const saved = await db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: catalogProducts.id })
      .from(catalogProducts)
      .where(eq(catalogProducts.id, productId))
      .for("update");
    if (!product) return { ok: false as const, error: "کالا پیدا نشد" };
    const [{ n }] = await tx
      .select({ n: count() })
      .from(catalogProductPhotos)
      .where(eq(catalogProductPhotos.productId, productId));
    if (n >= MAX_PHOTOS_PER_PRODUCT) {
      return { ok: false as const, error: "هر کالا حداکثر ۶ عکس می‌تواند داشته باشد" };
    }
    const [row] = await tx
      .insert(catalogProductPhotos)
      .values({ productId, fileName, position: n })
      .returning({ id: catalogProductPhotos.id });
    return { ok: true as const, id: row.id };
  });
  if (!saved.ok) return saved;

  try {
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(path.join(/*turbopackIgnore: true*/ uploadDir(), fileName), bytes);
  } catch (e) {
    await db.delete(catalogProductPhotos).where(eq(catalogProductPhotos.id, saved.id));
    throw e;
  }
  return { ok: true };
}

export async function removePhoto(photoId: string) {
  const [row] = await db
    .delete(catalogProductPhotos)
    .where(eq(catalogProductPhotos.id, photoId))
    .returning({ fileName: catalogProductPhotos.fileName });
  if (row && isSafePhotoName(row.fileName)) {
    await unlink(path.join(/*turbopackIgnore: true*/ uploadDir(), row.fileName)).catch(() => undefined);
  }
}

/** Bytes of one photo for /media/<name>, or null. Only names this app wrote are read. */
export async function readPhoto(name: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!isSafePhotoName(name)) return null;
  try {
    const bytes = new Uint8Array(await readFile(path.join(/*turbopackIgnore: true*/ uploadDir(), name)));
    const ext = name.slice(name.lastIndexOf(".") + 1) as keyof typeof PHOTO_CONTENT_TYPES;
    return { bytes, contentType: PHOTO_CONTENT_TYPES[ext] };
  } catch {
    return null;
  }
}

// ── Excel import ───────────────────────────────────────────────────────────────────────

export type ImportReport = {
  created: number;
  updated: number;
  skipped: { row: number; code: string; reason: string }[];
};

/**
 * One transaction. Per row: new code → create product (name, purchase price, car link; car created
 * if missing). Code already in this warehouse → update the purchase price only (+ car link if
 * missing); the name staff may have edited is never touched. Code in another warehouse → skipped.
 */
export async function warehouseExists(id: string): Promise<boolean> {
  return (await getWarehouseProfits([id])).has(id);
}

export async function importStockSheet(warehouseId: string, rows: StockRow[]): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, skipped: [] };
  if (rows.length === 0) return report;

  await db.transaction(async (tx) => {
    // Cars named in the sheet: create the missing ones, then map name → id.
    const carNames = [...new Set(rows.map((r) => r.car).filter((c): c is string => !!c))];
    if (carNames.length > 0) {
      await tx.insert(catalogCars).values(carNames.map((name) => ({ name }))).onConflictDoNothing();
    }
    const cars = carNames.length
      ? await tx.select({ id: catalogCars.id, name: catalogCars.name }).from(catalogCars).where(inArray(catalogCars.name, carNames))
      : [];
    const carId = new Map(cars.map((c) => [c.name, c.id]));

    const codes = rows.map((r) => r.code);
    const existing = await tx
      .select({ id: catalogProducts.id, code: catalogProducts.code, warehouseId: catalogProducts.warehouseId })
      .from(catalogProducts)
      .where(inArray(catalogProducts.code, codes));
    const byCode = new Map(existing.map((p) => [p.code, p]));

    const toCreate: StockRow[] = [];
    const links: { productId: string; carId: string }[] = [];
    for (const r of rows) {
      const found = byCode.get(r.code);
      if (!found) {
        toCreate.push(r);
        continue;
      }
      if (found.warehouseId !== warehouseId) {
        report.skipped.push({ row: r.row, code: r.code, reason: "این کد در انبار دیگری ثبت شده است" });
        continue;
      }
      await tx
        .update(catalogProducts)
        .set({ purchasePriceToman: r.purchaseToman, updatedAt: new Date() })
        .where(eq(catalogProducts.id, found.id));
      report.updated++;
      const c = r.car ? carId.get(r.car) : undefined;
      if (c) links.push({ productId: found.id, carId: c });
    }

    for (let i = 0; i < toCreate.length; i += 500) {
      const chunk = toCreate.slice(i, i + 500);
      const created = await tx
        .insert(catalogProducts)
        .values(
          chunk.map((r) => ({
            warehouseId,
            code: r.code,
            name: r.name,
            purchasePriceToman: r.purchaseToman,
            searchText: buildSearchText(r.name, r.code, null),
          })),
        )
        .returning({ id: catalogProducts.id, code: catalogProducts.code });
      const rowByCode = new Map(chunk.map((r) => [r.code, r]));
      for (const p of created) {
        const car = rowByCode.get(p.code)?.car;
        const c = car ? carId.get(car) : undefined;
        if (c) links.push({ productId: p.id, carId: c });
      }
      report.created += created.length;
    }

    for (let i = 0; i < links.length; i += 1000) {
      await tx.insert(catalogProductCars).values(links.slice(i, i + 1000)).onConflictDoNothing();
    }
  });

  return report;
}

// ── Shop reads (active products only; no purchase price, profit or warehouse) ──────────

export type ShopProduct = {
  id: string;
  code: string;
  name: string;
  brandName: string | null;
  countryName: string | null;
  shopPriceToman: number | null;
  isUnavailable: boolean;
  unit: Unit;
  photo: string | null;
};

const firstPhoto = sql<string | null>`(
  select ${catalogProductPhotos.fileName} from ${catalogProductPhotos}
  where ${catalogProductPhotos.productId} = ${catalogProducts.id}
  order by ${catalogProductPhotos.position}, ${catalogProductPhotos.createdAt} limit 1
)`;

const shopColumns = {
  id: catalogProducts.id,
  code: catalogProducts.code,
  name: catalogProducts.name,
  warehouseId: catalogProducts.warehouseId,
  purchasePriceToman: catalogProducts.purchasePriceToman,
  isUnavailable: catalogProducts.isUnavailable,
  unit: catalogProducts.unit,
  brandName: catalogBrands.name,
  countryName: catalogCountries.name,
  photo: firstPhoto,
};

type ShopRow = {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  purchasePriceToman: number | null;
  isUnavailable: boolean;
  unit: Unit;
  brandName: string | null;
  countryName: string | null;
  photo: string | null;
};

/** Turns DB rows into what a shopper may see: the shop price replaces purchase price + warehouse. */
async function toShop(rows: ShopRow[]): Promise<ShopProduct[]> {
  const profits = await getWarehouseProfits(rows.map((r) => r.warehouseId));
  return rows.map(({ warehouseId, purchasePriceToman, ...r }) => ({
    ...r,
    shopPriceToman: shopPriceToman(purchasePriceToman, profits.get(warehouseId) ?? 0),
  }));
}

function shopQuery() {
  return db
    .select(shopColumns)
    .from(catalogProducts)
    .leftJoin(catalogBrands, eq(catalogBrands.id, catalogProducts.brandId))
    .leftJoin(catalogCountries, eq(catalogCountries.id, catalogProducts.countryId));
}

export type ShopSearch = {
  q?: string;
  carId?: string;
  categoryId?: string;
  brandId?: string;
  countryId?: string;
  page: number;
  pageSize: number;
};

export async function searchProducts(s: ShopSearch): Promise<{ items: ShopProduct[]; total: number }> {
  const where: SQL[] = [eq(catalogProducts.isActive, true)];
  for (const w of searchWords(s.q ?? "")) where.push(ilike(catalogProducts.searchText, likeContains(w)));
  if (s.carId) {
    where.push(
      sql`exists (select 1 from ${catalogProductCars} where ${catalogProductCars.productId} = ${catalogProducts.id} and ${catalogProductCars.carId} = ${s.carId})`,
    );
  }
  if (s.categoryId) {
    // A main category also shows the products of its sub-categories.
    where.push(
      or(
        eq(catalogProducts.categoryId, s.categoryId),
        inArray(
          catalogProducts.categoryId,
          db.select({ id: catalogCategories.id }).from(catalogCategories).where(eq(catalogCategories.parentId, s.categoryId)),
        ),
      )!,
    );
  }
  if (s.brandId) where.push(eq(catalogProducts.brandId, s.brandId));
  if (s.countryId) where.push(eq(catalogProducts.countryId, s.countryId));
  const cond = and(...where);

  const [rows, [{ total }]] = await Promise.all([
    shopQuery()
      .where(cond)
      .orderBy(asc(catalogProducts.isUnavailable), asc(catalogProducts.name))
      .limit(s.pageSize)
      .offset((s.page - 1) * s.pageSize),
    db.select({ total: count() }).from(catalogProducts).where(cond),
  ]);
  return { items: await toShop(rows), total };
}

export type ShopProductDetails = ShopProduct & {
  description: string;
  categoryName: string | null;
  partGroupId: string | null;
  cars: string[];
  photos: string[];
};

/** The product page. Inactive or missing → null (the page shows "not found"). */
export async function getProductByCode(code: string): Promise<ShopProductDetails | null> {
  const [row] = await shopQuery()
    .where(and(eq(catalogProducts.code, code), eq(catalogProducts.isActive, true)));
  if (!row) return null;
  const [details] = await db
    .select({
      description: catalogProducts.description,
      partGroupId: catalogProducts.partGroupId,
      categoryName: catalogCategories.name,
    })
    .from(catalogProducts)
    .leftJoin(catalogCategories, eq(catalogCategories.id, catalogProducts.categoryId))
    .where(eq(catalogProducts.id, row.id));
  const [cars, photos, [shop]] = await Promise.all([
    db
      .select({ name: catalogCars.name })
      .from(catalogProductCars)
      .innerJoin(catalogCars, eq(catalogCars.id, catalogProductCars.carId))
      .where(eq(catalogProductCars.productId, row.id))
      .orderBy(asc(catalogCars.name)),
    listPhotos(row.id),
    toShop([row]),
  ]);
  return {
    ...shop,
    ...details,
    cars: cars.map((c) => c.name),
    photos: photos.map((p) => p.fileName),
  };
}

/** «مدل‌های دیگر این قطعه»: the other active products of the same part group. */
export async function listOtherModels(productId: string, partGroupId: string | null): Promise<ShopProduct[]> {
  if (!partGroupId) return [];
  const rows = await shopQuery()
    .where(
      and(
        eq(catalogProducts.partGroupId, partGroupId),
        eq(catalogProducts.isActive, true),
        ne(catalogProducts.id, productId),
      ),
    )
    .orderBy(asc(catalogProducts.name))
    .limit(50);
  return toShop(rows);
}

export async function listFilterOptions() {
  const [cars, categories, brands, countries] = await Promise.all([
    listItems("cars"),
    listItems("categories"),
    listItems("brands"),
    listItems("countries"),
  ]);
  return { cars, categories, brands, countries };
}

/** Everything the product form needs for its drop-downs. */
export async function listProductFormOptions() {
  const [warehouses, cars, categories, brands, countries, partGroups] = await Promise.all([
    listWarehouses(),
    listItems("cars"),
    listItems("categories"),
    listItems("brands"),
    listItems("countries"),
    listItems("partGroups"),
  ]);
  return {
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
    cars,
    categories,
    brands,
    countries,
    partGroups,
  };
}

// ── For the cart and requests (#5) ─────────────────────────────────────────────────────

export type CartProduct = {
  id: string;
  code: string;
  name: string;
  unit: Unit;
  shopPriceToman: number | null;
  isActive: boolean;
  isUnavailable: boolean;
  warehouseId: string;
};

/** Today's state of the given products, with the shop price (never the purchase price). */
export async function getCartProducts(ids: readonly string[]): Promise<CartProduct[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: catalogProducts.id,
      code: catalogProducts.code,
      name: catalogProducts.name,
      unit: catalogProducts.unit,
      purchasePriceToman: catalogProducts.purchasePriceToman,
      isActive: catalogProducts.isActive,
      isUnavailable: catalogProducts.isUnavailable,
      warehouseId: catalogProducts.warehouseId,
    })
    .from(catalogProducts)
    .where(inArray(catalogProducts.id, [...new Set(ids)]));
  const profits = await getWarehouseProfits(rows.map((r) => r.warehouseId));
  return rows.map(({ purchasePriceToman, ...r }) => ({
    ...r,
    shopPriceToman: shopPriceToman(purchasePriceToman, profits.get(r.warehouseId) ?? 0),
  }));
}

/** Staff adding a row to a request by technical code. Any product, active or not. */
export async function getProductForStaff(code: string): Promise<CartProduct | null> {
  const [row] = await db
    .select({ id: catalogProducts.id })
    .from(catalogProducts)
    .where(eq(catalogProducts.code, normalizeCode(code)));
  if (!row) return null;
  const [p] = await getCartProducts([row.id]);
  return p ?? null;
}
