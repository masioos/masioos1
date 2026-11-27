import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/env";
import { getIsacoWarehouseId, setIsacoWarehouseId } from "@/modules/settings";
import { getStaffNames } from "@/modules/staff";
import { getWarehouseProfits, listWarehouses, setWarehouseCodePrefix } from "@/modules/warehouses";
import {
  buildSearchText,
  detectImageType,
  isSafePhotoName,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PRODUCT,
  normalizeCode,
  PHOTO_CONTENT_TYPES,
  planIsacoPrices,
  planStockImport,
  makeListCodes,
  withBrand,
  waitingToApply,
  sheetModeFor,
  type ExistingGood,
  type SheetMode,
  type StockImportPlan,
  type StockRowError,
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
  catalogIsacoRuns,
  catalogIsacoWaiting,
  catalogPartGroups,
  catalogPriceHistory,
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

export type ListItem = { id: string; name: string; parentId?: string | null; shortCode?: string | null };

export async function listItems(kind: ListKind): Promise<ListItem[]> {
  if (kind === "categories") {
    return db
      .select({ id: catalogCategories.id, name: catalogCategories.name, parentId: catalogCategories.parentId })
      .from(catalogCategories)
      .orderBy(asc(catalogCategories.name));
  }
  if (kind === "cars") {
    return db
      .select({ id: catalogCars.id, name: catalogCars.name, shortCode: catalogCars.shortCode })
      .from(catalogCars)
      .orderBy(asc(catalogCars.name));
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
    if (input.kind === "cars") {
      const values = { name: input.name, shortCode: input.shortCode };
      if (input.id) await db.update(catalogCars).set(values).where(eq(catalogCars.id, input.id));
      else await db.insert(catalogCars).values(values);
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
    if (uniqueViolation(e) !== null) return { ok: false, error: "این نام یا کد قبلاً ثبت شده است" };
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

export async function createProduct(input: ProductInput, staffId: string): Promise<Result<{ id: string }>> {
  const brand = await brandName(input.brandId);
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(catalogProducts)
        .values(productValues(input, brand))
        .returning({ id: catalogProducts.id });
      await recordPriceChanges(tx, [{ productId: row.id, oldToman: null, newToman: input.purchasePriceToman }], "hand", staffId);
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

/** Price history (#8): one line per real purchase-price change. */
export type PriceSource = "hand" | "sheet" | "isaco";

async function recordPriceChanges(
  tx: Pick<typeof db, "insert">,
  changes: readonly { productId: string; oldToman: number | null; newToman: number | null }[],
  source: PriceSource,
  staffId: string | null,
) {
  const real = changes.filter((c) => c.oldToman !== c.newToman);
  for (let i = 0; i < real.length; i += 1000) {
    await tx.insert(catalogPriceHistory).values(real.slice(i, i + 1000).map((c) => ({ ...c, source, staffId })));
  }
}

export async function updateProduct(id: string, input: ProductInput, staffId: string): Promise<Result> {
  const brand = await brandName(input.brandId);
  try {
    const found = await db.transaction(async (tx) => {
      const [before] = await tx
        .select({ price: catalogProducts.purchasePriceToman })
        .from(catalogProducts)
        .where(eq(catalogProducts.id, id))
        .for("update");
      if (!before) return false;
      const updated = await tx
        .update(catalogProducts)
        .set({ ...productValues(input, brand), updatedAt: new Date() })
        .where(eq(catalogProducts.id, id))
        .returning({ id: catalogProducts.id });
      if (updated.length === 0) return false;
      await recordPriceChanges(tx, [{ productId: id, oldToman: before.price, newToman: input.purchasePriceToman }], "hand", staffId);
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
    .set(
      flag === "isUnavailable"
        ? // By hand: a stock sheet never makes it available again (#2).
          { isUnavailable: value, unavailableSource: value ? ("hand" as const) : null, updatedAt: new Date() }
        : { isActive: value, updatedAt: new Date() },
    )
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

// ── Excel import (#2) ──────────────────────────────────────────────────────────────────

type PriceRow = { code: string; name: string; oldToman: number | null; newToman: number | null };

export type ImportReport = {
  created: number;
  pricesChanged: PriceRow[];
  madeAvailable: number;
  madeUnavailable: { code: string; name: string }[];
  skipped: { row: number; code: string; reason: string }[];
};

/** What an import would change, shown before «تأیید و ورود». Nothing is written. */
export type ImportPreview = {
  /** Price lists (#3): the warehouse or a car still needs an English code; typed in the preview. */
  codeProblem: string | null;
  codeNeeds: CodeNeeds | null;
  warehouseName: string;
  mode: SheetMode;
  newRows: StockRow[];
  pricesChanged: PriceRow[];
  madeAvailable: number;
  madeUnavailable: { code: string; name: string }[];
  skipped: StockRowError[];
  needsConfirm: boolean;
};

/** UPLOAD_DIR/imports: a sheet waits here between the preview and «تأیید و ورود» (manager only). */
function importsDir() {
  return path.join(/*turbopackIgnore: true*/ uploadDir(), "imports");
}

const SHEET_KEEP_MS = 24 * 60 * 60 * 1000;

/** What the manager saw in the preview: the warehouse and its sheet mode, kept next to the file. */
/** `kind`: an Excel stock sheet or a PDF price list (#3); both become stock-sheet rows. */
export type KeptSheet = { warehouseId: string; mode: SheetMode; kind: "xlsx" | "pdf" };

const keptFile = (token: string, ext: "xlsx" | "json") => path.join(/*turbopackIgnore: true*/ importsDir(), `${token}.${ext}`);

/**
 * Keeps an uploaded sheet for step 3, with the warehouse and mode of the preview; returns its
 * token. Files older than a day are removed.
 */
export async function keepSheetFile(bytes: Uint8Array, kept: KeptSheet): Promise<string> {
  await mkdir(importsDir(), { recursive: true });
  for (const name of await readdir(importsDir())) {
    const file = path.join(/*turbopackIgnore: true*/ importsDir(), name);
    try {
      if (Date.now() - (await stat(file)).mtimeMs > SHEET_KEEP_MS) await unlink(file);
    } catch {
      // Removed by another request at the same moment, or not a file: leave it.
    }
  }
  const token = randomUUID();
  await writeFile(keptFile(token, "xlsx"), bytes);
  await writeFile(keptFile(token, "json"), JSON.stringify(kept));
  return token;
}

/** The kept sheet of `token` (a uuid checked by the action) and what the preview was for; null if gone. */
export async function readSheetFile(token: string): Promise<{ bytes: Buffer; kept: KeptSheet } | null> {
  try {
    const [bytes, json] = await Promise.all([readFile(keptFile(token, "xlsx")), readFile(keptFile(token, "json"), "utf8")]);
    return { bytes, kept: JSON.parse(json) as KeptSheet };
  } catch {
    return null;
  }
}

export async function dropSheetFile(token: string) {
  await Promise.all([unlink(keptFile(token, "xlsx")).catch(() => {}), unlink(keptFile(token, "json")).catch(() => {})]);
}

export async function warehouseExists(id: string): Promise<boolean> {
  return (await getWarehouseProfits([id])).has(id);
}

async function warehouseOf(id: string): Promise<{ name: string; mode: SheetMode; codePrefix: string | null } | null> {
  const [list, isacoId] = await Promise.all([listWarehouses(), getIsacoWarehouseId()]);
  const w = list.find((x) => x.id === id);
  return w ? { name: w.name, mode: sheetModeFor(w.id, isacoId), codePrefix: w.codePrefix } : null;
}

/**
 * Price-list rows (#3) carry a temporary code; a good this warehouse already has with the same
 * name + car (`list_key`) gives the row its real code, so the plan matches it.
 */
async function resolveListRows(q: Reader, warehouseId: string, rows: StockRow[]): Promise<StockRow[]> {
  const keys = rows.flatMap((r) => (r.listKey ? [r.listKey] : []));
  if (keys.length === 0) return rows;
  const known = await q
    .select({ code: catalogProducts.code, listKey: catalogProducts.listKey })
    .from(catalogProducts)
    .where(and(eq(catalogProducts.warehouseId, warehouseId), inArray(catalogProducts.listKey, keys)));
  const codeOf = new Map(known.map((k) => [k.listKey, k.code]));
  return rows.map((r) => (r.listKey && codeOf.has(r.listKey) ? { ...r, code: codeOf.get(r.listKey) ?? r.code } : r));
}

/**
 * Codes like «RF.PR.012» for the price-list goods that need one (new ones, and goods made before
 * codes were readable). A Persian message when the warehouse or a car has no English code yet.
 */
async function listCodesFor(
  q: Reader,
  w: { name: string; codePrefix: string | null },
  rows: readonly StockRow[],
): Promise<{ ok: true; codes: Map<string, string> } | { ok: false; error: string; needs: CodeNeeds }> {
  const need = rows.filter((r) => r.listKey);
  if (need.length === 0) return { ok: true, codes: new Map() };
  if (!w.codePrefix) {
    const cars = [...new Set(need.flatMap((r) => (r.car ? [r.car] : [])))];
    const known = cars.length
      ? await q.select({ name: catalogCars.name, shortCode: catalogCars.shortCode }).from(catalogCars).where(inArray(catalogCars.name, cars))
      : [];
    const coded = new Set(known.filter((c) => c.shortCode).map((c) => c.name));
    return {
      ok: false,
      error: `برای ساختن کد کالاها، کد انگلیسی انبار «${w.name}» لازم است.`,
      needs: { prefix: true, cars: cars.filter((c) => !coded.has(c)) },
    };
  }
  const [cars, used] = await Promise.all([
    q.select({ name: catalogCars.name, shortCode: catalogCars.shortCode }).from(catalogCars),
    q.select({ code: catalogProducts.code }).from(catalogProducts).where(ilike(catalogProducts.code, `${w.codePrefix}.%`)),
  ]);
  const res = makeListCodes(
    need.map((r) => ({ key: r.listKey ?? "", car: r.car })),
    w.codePrefix,
    new Map(cars.map((c) => [c.name, c.shortCode])),
    used.map((u) => u.code),
  );
  if (res.missingCars.length > 0) {
    return {
      ok: false,
      error: `برای ساختن کد کالاها، کد انگلیسی این خودروها لازم است: ${res.missingCars.join("، ")}`,
      needs: { prefix: false, cars: res.missingCars },
    };
  }
  return { ok: true, codes: res.codes };
}

/** English codes the preview asks for (#3): the warehouse's, and cars with none. */
export type CodeNeeds = { prefix: boolean; cars: string[] };

/** Price-list goods with no readable code yet (made before #3's codes): matched by their temporary code. */
async function oldListGoods(q: Reader, warehouseId: string, rows: readonly StockRow[]) {
  const temp = rows.filter((r) => r.listKey).map((r) => r.code);
  if (temp.length === 0) return [];
  return q
    .select({ id: catalogProducts.id, code: catalogProducts.code, name: catalogProducts.name, brandId: catalogProducts.brandId })
    .from(catalogProducts)
    .where(and(eq(catalogProducts.warehouseId, warehouseId), isNull(catalogProducts.listKey), inArray(catalogProducts.code, temp)));
}

type Reader = Pick<typeof db, "select">;

/** This warehouse's goods, plus any good (of any warehouse) with one of the sheet's codes. */
async function goodsFor(q: Reader, warehouseId: string, rows: readonly StockRow[]): Promise<ExistingGood[]> {
  const codes = rows.map((r) => r.code);
  return q
    .select({
      id: catalogProducts.id,
      code: catalogProducts.code,
      name: catalogProducts.name,
      warehouseId: catalogProducts.warehouseId,
      purchasePriceToman: catalogProducts.purchasePriceToman,
      fromSheet: catalogProducts.fromSheet,
      brandId: catalogProducts.brandId,
      isUnavailable: catalogProducts.isUnavailable,
      unavailableSource: catalogProducts.unavailableSource,
    })
    .from(catalogProducts)
    .where(
      codes.length > 0
        ? or(eq(catalogProducts.warehouseId, warehouseId), inArray(catalogProducts.code, codes))
        : eq(catalogProducts.warehouseId, warehouseId),
    );
}

const short = (list: { code: string; name: string }[]) => list.map(({ code, name }) => ({ code, name }));
const prices = (list: StockImportPlan["priceUpdates"]): PriceRow[] =>
  list.map((u) => ({ code: u.code, name: u.name, oldToman: u.oldToman, newToman: u.purchaseToman }));

/** Step 2 of «ورود از Excel»: what the sheet would change, with the new codes to tick. */
export async function previewStockSheet(
  warehouseId: string,
  rows: StockRow[],
  rejected: StockRowError[],
): Promise<ImportPreview | null> {
  const w = await warehouseOf(warehouseId);
  if (!w) return null;
  const resolved = await resolveListRows(db, warehouseId, rows);
  const existing = await goodsFor(db, warehouseId, resolved);
  const plan = planStockImport({ warehouseId, mode: w.mode, rows: resolved, existing, selectedNew: new Set(), rejected });
  const old = new Set((await oldListGoods(db, warehouseId, resolved)).map((g) => g.code));
  const codes = await listCodesFor(db, w, [...plan.newRows, ...resolved.filter((r) => old.has(r.code))]);
  return {
    codeProblem: codes.ok ? null : codes.error,
    codeNeeds: codes.ok ? null : codes.needs,
    warehouseName: w.name,
    mode: w.mode,
    newRows: plan.newRows,
    pricesChanged: prices(plan.priceUpdates),
    madeAvailable: plan.makeAvailable.length,
    madeUnavailable: short(plan.makeUnavailable),
    skipped: plan.skipped,
    needsConfirm: plan.needsConfirm,
  };
}

const CONFIRM_NEEDED = "بیشتر از نصف کالاهای این انبار ناموجود می‌شوند. اگر مطمئنی، تیک «مطمئنم» را بزن.";

/**
 * Step 3: one transaction, planned again from the database as it is now (`planStockImport`).
 * Only ticked new codes are created; names are never changed; nothing is deleted.
 */
export async function importStockSheet(
  warehouseId: string,
  rows: StockRow[],
  opts: {
    selectedNew: ReadonlySet<string>;
    confirmed: boolean;
    rejected: StockRowError[];
    previewMode: SheetMode;
    staffId: string;
    /** English codes typed in the preview (#3): the warehouse's, and cars' by car name. */
    given?: { prefix: string | null; cars: ReadonlyMap<string, string> };
  },
): Promise<{ ok: true; report: ImportReport } | { ok: false; error: string }> {
  const found = await warehouseOf(warehouseId);
  if (!found) return { ok: false, error: "انبار پیدا نشد" };
  let w = found;
  if (opts.given?.prefix && !w.codePrefix) {
    if (!(await setWarehouseCodePrefix(warehouseId, opts.given.prefix))) {
      return { ok: false, error: `کد «${opts.given.prefix}» برای انبار دیگری است. کد دیگری بنویسید.` };
    }
    w = { ...w, codePrefix: opts.given.prefix };
  }
  // The manager approved what the preview showed: a mode changed since then would change other things.
  if (w.mode !== opts.previewMode) return { ok: false, error: "تنظیم فایل اکسل این انبار عوض شده است. فایل را دوباره بخوانید." };

  return db.transaction(async (tx) => {
    const resolved = await resolveListRows(tx, warehouseId, rows);
    const existing = await goodsFor(tx, warehouseId, resolved);
    const plan = planStockImport({ warehouseId, mode: w.mode, rows: resolved, existing, selectedNew: opts.selectedNew, rejected: opts.rejected });
    if (plan.needsConfirm && !opts.confirmed) return { ok: false as const, error: CONFIRM_NEEDED };
    // Price-list goods (#3): readable codes, the warehouse as brand at the end of the name.
    const old = await oldListGoods(tx, warehouseId, resolved);
    const oldCodes = new Set(old.map((g) => g.code));
    // Cars typed in the preview: made (or given their code) before the codes are worked out.
    for (const [name, shortCode] of opts.given?.cars ?? []) {
      const [taken] = await tx.select({ name: catalogCars.name }).from(catalogCars).where(eq(catalogCars.shortCode, shortCode));
      if (taken && taken.name !== name) return { ok: false as const, error: `کد «${shortCode}» مال خودروی «${taken.name}» است. کد دیگری بنویسید.` };
      await tx
        .insert(catalogCars)
        .values({ name, shortCode })
        .onConflictDoUpdate({ target: catalogCars.name, set: { shortCode }, setWhere: isNull(catalogCars.shortCode) });
    }
    const listCodes = await listCodesFor(tx, w, [...plan.create, ...resolved.filter((r) => oldCodes.has(r.code))]);
    if (!listCodes.ok) return { ok: false as const, error: listCodes.error };
    // Every good that comes from a warehouse's file has the warehouse as brand, at the end of its name.
    await tx.insert(catalogBrands).values({ name: w.name }).onConflictDoNothing();
    const [brand] = await tx.select({ id: catalogBrands.id }).from(catalogBrands).where(eq(catalogBrands.name, w.name));
    const brandId = brand?.id ?? null;
    const now = new Date();
    // Goods made from a list before readable codes: give them their code, brand and key now.
    const converted = new Set<string>();
    for (const g of old) {
      const row = resolved.find((r) => r.code === g.code);
      const code = row?.listKey ? listCodes.codes.get(row.listKey) : undefined;
      if (!row || !code) continue;
      const name = withBrand(g.name, w.name);
      await tx
        .update(catalogProducts)
        .set({ code, name, brandId: g.brandId ?? brandId, listKey: row.listKey, searchText: buildSearchText(name, code, w.name), updatedAt: now })
        .where(eq(catalogProducts.id, g.id));
      converted.add(g.id);
    }

    // Cars named in the rows we write: create the missing ones, then map name → id.
    const used = [...plan.create, ...plan.matched.map((m) => m.row)];
    const carNames = [...new Set(used.map((r) => r.car).filter((c): c is string => !!c))];
    if (carNames.length > 0) await tx.insert(catalogCars).values(carNames.map((name) => ({ name }))).onConflictDoNothing();
    const cars = carNames.length
      ? await tx.select({ id: catalogCars.id, name: catalogCars.name }).from(catalogCars).where(inArray(catalogCars.name, carNames))
      : [];
    const carId = new Map(cars.map((c) => [c.name, c.id]));
    const links: { productId: string; carId: string }[] = [];
    const link = (productId: string, car: string | null) => {
      const c = car ? carId.get(car) : undefined;
      if (c) links.push({ productId, carId: c });
    };

    for (const u of plan.priceUpdates) {
      await tx.update(catalogProducts).set({ purchasePriceToman: u.purchaseToman, updatedAt: now }).where(eq(catalogProducts.id, u.id));
    }
    await recordPriceChanges(
      tx,
      plan.priceUpdates.map((u) => ({ productId: u.id, oldToman: u.oldToman, newToman: u.purchaseToman })),
      "sheet",
      opts.staffId,
    );
    const ids = (list: { id: string }[]) => list.map((x) => x.id);
    for (let i = 0; i < plan.matched.length; i += 1000) {
      const chunk = plan.matched.slice(i, i + 1000);
      await tx.update(catalogProducts).set({ fromSheet: true }).where(inArray(catalogProducts.id, ids(chunk)));
      for (const m of chunk) link(m.id, m.row.car);
    }
    // Goods made before the brand rule: every good of this warehouse that came from a file (in this
    // one or an earlier one, available or not) gets the warehouse brand at the end of its name, once.
    const matchedIds = new Set(plan.matched.map((m) => m.id));
    for (const good of existing) {
      if (good.warehouseId !== warehouseId || !(good.fromSheet || matchedIds.has(good.id)) || converted.has(good.id)) continue;
      const named = withBrand(good.name, w.name);
      if (named === good.name) continue;
      await tx
        .update(catalogProducts)
        .set({ name: named, brandId: good.brandId ?? brandId, searchText: buildSearchText(named, good.code, w.name), updatedAt: now })
        .where(eq(catalogProducts.id, good.id));
    }
    if (plan.makeAvailable.length > 0) {
      await tx
        .update(catalogProducts)
        .set({ isUnavailable: false, unavailableSource: null, updatedAt: now })
        .where(and(inArray(catalogProducts.id, ids(plan.makeAvailable)), eq(catalogProducts.unavailableSource, "sheet")));
    }
    if (plan.makeUnavailable.length > 0) {
      await tx
        .update(catalogProducts)
        .set({ isUnavailable: true, unavailableSource: "sheet", updatedAt: now })
        .where(and(inArray(catalogProducts.id, ids(plan.makeUnavailable)), eq(catalogProducts.isUnavailable, false)));
    }

    let created = 0;
    for (let i = 0; i < plan.create.length; i += 500) {
      const chunk = plan.create.slice(i, i + 500);
      const rowsMade = await tx
        .insert(catalogProducts)
        .values(
          chunk.map((r) => {
            const code = (r.listKey && listCodes.codes.get(r.listKey)) || r.code;
            const name = withBrand(r.name, w.name);
            return {
            warehouseId,
            code,
            name,
            brandId,
            listKey: r.listKey ?? null,
            purchasePriceToman: r.purchaseToman,
            unit: r.unit ?? "piece",
            fromSheet: true,
            searchText: buildSearchText(name, code, w.name),
            };
          }),
        )
        .returning({ id: catalogProducts.id, code: catalogProducts.code });
      const rowByCode = new Map(chunk.map((r) => [(r.listKey && listCodes.codes.get(r.listKey)) || r.code, r]));
      for (const p of rowsMade) link(p.id, rowByCode.get(p.code)?.car ?? null);
      await recordPriceChanges(
        tx,
        rowsMade.map((p) => ({ productId: p.id, oldToman: null, newToman: rowByCode.get(p.code)?.purchaseToman ?? null })),
        "sheet",
        opts.staffId,
      );
      created += rowsMade.length;
    }

    for (let i = 0; i < links.length; i += 1000) {
      await tx.insert(catalogProductCars).values(links.slice(i, i + 1000)).onConflictDoNothing();
    }

    return {
      ok: true as const,
      report: {
        created,
        pricesChanged: prices(plan.priceUpdates),
        madeAvailable: plan.makeAvailable.length,
        madeUnavailable: short(plan.makeUnavailable),
        skipped: plan.skipped,
      },
    };
  });
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

/** Staff only (request profit, #15): today's purchase price per product, whole Toman. Never shown to shoppers. */
export async function getPurchasePrices(ids: readonly string[]): Promise<Map<string, number | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: catalogProducts.id, purchase: catalogProducts.purchasePriceToman })
    .from(catalogProducts)
    .where(inArray(catalogProducts.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.purchase]));
}

// ── ISACO prices (#8) ──────────────────────────────────────────────────────────────────

export type IsacoRun = typeof catalogIsacoRuns.$inferSelect & { staffName: string };
export type IsacoWaitingRow = { code: string; name: string; oldToman: number | null; newToman: number };

/** The newest upload of ISACO's file, or null. */
export async function lastIsacoRun(): Promise<IsacoRun | null> {
  const [run] = await db.select().from(catalogIsacoRuns).orderBy(desc(catalogIsacoRuns.at)).limit(1);
  if (!run) return null;
  const names = await getStaffNames(run.staffId ? [run.staffId] : []);
  return { ...run, staffName: run.staffId ? (names.get(run.staffId) ?? "") : "" };
}

/** The big jumps of a run still waiting for «تأیید». */
export async function isacoWaiting(runId: string): Promise<IsacoWaitingRow[]> {
  return db
    .select({
      code: catalogProducts.code,
      name: catalogProducts.name,
      oldToman: catalogIsacoWaiting.oldToman,
      newToman: catalogIsacoWaiting.newToman,
    })
    .from(catalogIsacoWaiting)
    .innerJoin(catalogProducts, eq(catalogProducts.id, catalogIsacoWaiting.productId))
    .where(eq(catalogIsacoWaiting.runId, runId))
    .orderBy(asc(catalogProducts.code));
}

export type IsacoReport = {
  fileRows: number;
  badRows: number;
  changed: IsacoWaitingRow[];
  unchanged: number;
  missing: number;
  noPrice: number;
  waiting: IsacoWaitingRow[];
};

const NO_ISACO_WAREHOUSE = "اول انبار ایساکو را انتخاب کنید.";

/**
 * One upload of ISACO's file: the purchase prices of the ISACO warehouse's goods (one transaction).
 * Big jumps wait (when there are more than 50); older waiting rows are dropped (their file is old).
 */
export async function importIsacoPrices(
  staffId: string,
  sheet: { prices: Map<string, number | null>; fileRows: number; badRows: number },
): Promise<{ ok: true; report: IsacoReport } | { ok: false; error: string }> {
  const warehouseId = await getIsacoWarehouseId();
  if (!warehouseId || !(await warehouseExists(warehouseId))) return { ok: false, error: NO_ISACO_WAREHOUSE };

  return db.transaction(async (tx) => {
    const goods = await tx
      .select({
        id: catalogProducts.id,
        code: catalogProducts.code,
        name: catalogProducts.name,
        warehouseId: catalogProducts.warehouseId,
        purchasePriceToman: catalogProducts.purchasePriceToman,
      })
      .from(catalogProducts)
      .where(eq(catalogProducts.warehouseId, warehouseId))
      .for("update");
    const plan = planIsacoPrices(warehouseId, goods, sheet.prices);
    const now = new Date();
    for (const c of plan.apply) {
      await tx.update(catalogProducts).set({ purchasePriceToman: c.newToman, updatedAt: now }).where(eq(catalogProducts.id, c.id));
    }
    await recordPriceChanges(
      tx,
      plan.apply.map((c) => ({ productId: c.id, oldToman: c.oldToman, newToman: c.newToman })),
      "isaco",
      staffId,
    );
    await tx.delete(catalogIsacoWaiting);
    const [run] = await tx
      .insert(catalogIsacoRuns)
      .values({
        staffId,
        fileRows: sheet.fileRows,
        changed: plan.apply.length,
        unchanged: plan.unchanged,
        missing: plan.missing,
        noPrice: plan.noPrice,
        waiting: plan.waiting.length,
      })
      .returning({ id: catalogIsacoRuns.id });
    for (let i = 0; i < plan.waiting.length; i += 1000) {
      await tx.insert(catalogIsacoWaiting).values(
        plan.waiting.slice(i, i + 1000).map((c) => ({ runId: run.id, productId: c.id, oldToman: c.oldToman, newToman: c.newToman })),
      );
    }
    const row = ({ code, name, oldToman, newToman }: IsacoWaitingRow) => ({ code, name, oldToman, newToman });
    return {
      ok: true as const,
      report: {
        fileRows: sheet.fileRows,
        badRows: sheet.badRows,
        changed: plan.apply.map(row),
        unchanged: plan.unchanged,
        missing: plan.missing,
        noPrice: plan.noPrice,
        waiting: plan.waiting.map(row),
      },
    };
  });
}

/**
 * «تأیید تغییرهای بزرگ»: applies the waiting jumps of the newest run. A good whose price changed
 * since (by hand or another file) keeps that price.
 */
export async function approveIsacoWaiting(staffId: string, runId: string): Promise<Result> {
  return db.transaction(async (tx) => {
    const [newest] = await tx.select({ id: catalogIsacoRuns.id }).from(catalogIsacoRuns).orderBy(desc(catalogIsacoRuns.at)).limit(1);
    if (!newest || newest.id !== runId) return { ok: false, error: "فایل تازه‌تری آمده است. صفحه را دوباره باز کنید." };
    const waiting = await tx.select().from(catalogIsacoWaiting).where(eq(catalogIsacoWaiting.runId, runId));
    const isacoId = await getIsacoWarehouseId();
    const goods = waiting.length
      ? await tx
          .select({ id: catalogProducts.id, warehouseId: catalogProducts.warehouseId, purchasePriceToman: catalogProducts.purchasePriceToman })
          .from(catalogProducts)
          .where(inArray(catalogProducts.id, waiting.map((w) => w.productId)))
          .for("update")
      : [];
    const applied = waitingToApply(waiting, new Map(goods.map((g) => [g.id, g])), isacoId);
    const now = new Date();
    for (const w of applied) {
      await tx.update(catalogProducts).set({ purchasePriceToman: w.newToman, updatedAt: now }).where(eq(catalogProducts.id, w.productId));
    }
    await recordPriceChanges(tx, applied, "isaco", staffId);
    await tx.delete(catalogIsacoWaiting).where(eq(catalogIsacoWaiting.runId, runId));
    await tx.update(catalogIsacoRuns).set({ approvedAt: now }).where(eq(catalogIsacoRuns.id, runId));
    return { ok: true };
  });
}

/** «تاریخچه‌ی قیمت خرید» of one product, newest first. */
export async function priceHistory(productId: string) {
  const rows = await db
    .select()
    .from(catalogPriceHistory)
    .where(eq(catalogPriceHistory.productId, productId))
    .orderBy(desc(catalogPriceHistory.at))
    .limit(200);
  const names = await getStaffNames(rows.flatMap((r) => (r.staffId ? [r.staffId] : [])));
  return rows.map((r) => ({ ...r, staffName: r.staffId ? (names.get(r.staffId) ?? "") : "" }));
}

/** The ISACO warehouse and the warehouses to choose it from («قیمت ایساکو» page). */
export async function isacoWarehouseChoice() {
  const [current, list] = await Promise.all([getIsacoWarehouseId(), listWarehouses()]);
  return { current: list.some((w) => w.id === current) ? current : null, warehouses: list.map((w) => ({ id: w.id, name: w.name })) };
}

export async function chooseIsacoWarehouse(warehouseId: string): Promise<Result> {
  if (!(await warehouseExists(warehouseId))) return { ok: false, error: "انبار پیدا نشد" };
  await setIsacoWarehouseId(warehouseId);
  // Waiting big jumps were for the old ISACO warehouse's goods: they no longer apply.
  await db.delete(catalogIsacoWaiting);
  return { ok: true };
}
