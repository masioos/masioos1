import { z } from "zod";
import { groupFa } from "@/lib/money";

// Pure rules of the catalog module: no DB, no React, no I/O. Tests live next to this file.
// The shop-price rule lives here until the `pricing` module is built (#8), then moves there.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

// ── Money ──────────────────────────────────────────────────────────────────────────────

/**
 * Shop price = purchase price × (1 + profit), rounded DOWN to the nearest 1,000 Toman.
 * Integer math only: profit is in basis points (1000 = 10%). null (no price) stays null.
 * 2,352,000 at 1000 bp → 2,587,200 → 2,587,000.
 */
export function shopPriceToman(purchaseToman: number | null, profitBp: number): number | null {
  if (purchaseToman === null) return null;
  const withProfit = Math.floor((purchaseToman * (10_000 + profitBp)) / 10_000);
  return Math.floor(withProfit / 1000) * 1000;
}

/** Supplier sheets are in Rial. Toman = Rial ÷ 10, rounded down. 0 or empty → null (no price). */
export function rialToToman(rial: number | null | undefined): number | null {
  if (rial === null || rial === undefined || !Number.isFinite(rial) || rial <= 0) return null;
  const toman = Math.floor(rial / 10);
  return toman > 0 ? toman : null;
}

/** 2587000 → «۲٬۵۸۷٬۰۰۰ تومان». */
export function formatToman(toman: number): string {
  return `${groupFa(toman)} تومان`;
}

/** Reads a price typed by staff: Persian digits and thousands separators allowed. "" → null. */
export function parsePriceText(input: string): number | null | "invalid" {
  const text = toAsciiDigits(input).replace(/[,،٬/\s]/g, "");
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return "invalid";
  const n = Number(text);
  return n <= MAX_PRICE_TOMAN ? n : "invalid";
}

/** 1,000 billion Toman: far above any part, and small enough that price × profit stays exact. */
export const MAX_PRICE_TOMAN = 1_000_000_000_000;

// ── Text ───────────────────────────────────────────────────────────────────────────────

/**
 * One form for searching: Arabic ي/ك → Persian ی/ک, آ/أ/إ → ا, ة/ۀ → ه, ؤ → و, ئ → ی,
 * short vowels and tatweel removed, Persian/Arabic digits → ASCII, ZWNJ (half-space) → space,
 * Latin lower-case, spaces collapsed. Used on stored text and on queries, so «ارم» finds «آرم».
 * Keep in step with the SQL in migration 0004_search_letters.
 */
export function normalizeSearch(input: string): string {
  return toAsciiDigits(input)
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/[ةۀ]/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/[يىئ]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Technical code: ASCII digits, no spaces or dashes. «۰۲۷۰-۲۰۲۴۲۰» → "0270202420". */
export function normalizeCode(input: string): string {
  return toAsciiDigits(input).replace(/[\s\-_]/g, "").toUpperCase();
}

/** Technical codes use only Latin letters, digits and dots, so /p/<code> is always a clean link. */
export function isValidCode(code: string): boolean {
  return /^[A-Z0-9.]{1,40}$/.test(code);
}

/**
 * One spelling for list names (cars, brands, ...): Arabic ي/ك → Persian, digits → ASCII, spaces
 * collapsed. So «پژو ۴۰۵» typed by staff and «پژو 405» from an Excel sheet are the same car.
 */
export function normalizeName(input: string): string {
  return toAsciiDigits(input)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text stored in `search_text`: name + code + brand, normalized. */
export function buildSearchText(name: string, code: string, brandName: string | null): string {
  return normalizeSearch([name, code, brandName ?? ""].join(" "));
}

/** A query split into normalized words; every word must match. */
export function searchWords(query: string): string[] {
  return normalizeSearch(query).split(" ").filter(Boolean).slice(0, 8);
}

// ── Shop pages ─────────────────────────────────────────────────────────────────────────

/** How many goods one shop page shows; the shopper picks one. */
export const SHOP_PAGE_SIZES = [12, 24, 48, 96] as const;
export const DEFAULT_SHOP_PAGE_SIZE = 24;

/** A page size from the address bar; anything not offered → the default. */
export function shopPageSize(raw: string): number {
  const n = Number(raw);
  return (SHOP_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_SHOP_PAGE_SIZE;
}

// ── Cart ───────────────────────────────────────────────────────────────────────────────

/** Used by the cart (#5). A product with no price can still be added («برای قیمت تماس بگیرید»). */
export function canAddToCart(p: { isActive: boolean; isUnavailable: boolean }): boolean {
  return p.isActive && !p.isUnavailable;
}

// ── Forms ──────────────────────────────────────────────────────────────────────────────

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const productFormSchema = z.object({
  warehouseId: z.uuid("انبار را انتخاب کنید"),
  code: z
    .string()
    .transform(normalizeCode)
    .pipe(
      z
        .string()
        .min(1, "کد فنی لازم است")
        .max(40, "کد فنی خیلی بلند است")
        .refine(isValidCode, "کد فنی فقط می‌تواند حروف انگلیسی، عدد و نقطه داشته باشد"),
    ),
  name: z.string().trim().min(2, "نام کالا حداقل ۲ حرف است").max(300),
  brandId: optionalId,
  categoryId: optionalId,
  countryId: optionalId,
  partGroupId: optionalId,
  carIds: z
    .array(z.uuid())
    .default([])
    .transform((ids) => [...new Set(ids)]),
  description: z.string().trim().max(5000).default(""),
  unit: z.enum(["piece", "pair"]).default("piece"),
  purchasePriceToman: z
    .string()
    .default("")
    .transform((s, ctx) => {
      const n = parsePriceText(s);
      if (n === "invalid") {
        ctx.addIssue({ code: "custom", message: "قیمت خرید باید یک عدد مثبت به تومان باشد" });
        return z.NEVER;
      }
      return n;
    }),
});

export type ProductInput = z.infer<typeof productFormSchema>;

export const listKinds = ["cars", "brands", "countries", "categories", "partGroups"] as const;
export type ListKind = (typeof listKinds)[number];

export const listItemSchema = z.object({
  kind: z.enum(listKinds),
  id: optionalId,
  name: z.string().transform(normalizeName).pipe(z.string().min(2, "نام حداقل ۲ حرف است").max(200)),
  parentId: optionalId,
});

export type ListItemInput = z.infer<typeof listItemSchema>;

export const productFlagsSchema = z.object({
  id: z.uuid(),
  flag: z.enum(["isActive", "isUnavailable"]),
  value: z.enum(["true", "false"]).transform((v) => v === "true"),
});

// ── Photos ─────────────────────────────────────────────────────────────────────────────

export { detectImageType, isSafePhotoName, MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES } from "@/lib/image";
export const MAX_PHOTOS_PER_PRODUCT = 6;

// ── Stock sheet (supplier Excel) ─────────────────────────────────────────────────────

export const STOCK_SHEET_HEADERS = {
  code: "کد فنی قطعه",
  name: "نام قطعه",
  car: "گروه خودرو",
  priceRial: "قیمت فروش (ریال)",
} as const;

export type StockRow = { row: number; code: string; name: string; car: string | null; purchaseToman: number | null };
export type StockRowError = { row: number; code: string; reason: string };
export type StockSheet =
  | { ok: true; rows: StockRow[]; errors: StockRowError[] }
  | { ok: false; error: string };

function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function headerKey(cell: unknown): string {
  return normalizeSearch(cellText(cell)).replace(/\s*\(\s*/g, " (").replace(/\s*\)/g, ")");
}

function cellRial(cell: unknown): number | null | "invalid" {
  if (cell === null || cell === undefined || cell === "") return null;
  const rial = typeof cell === "number" ? cell : parsePriceText(String(cell));
  if (rial === null || rial === "invalid") return rial;
  return Number.isFinite(rial) && rial >= 0 && rial <= MAX_PRICE_TOMAN * 10 ? rial : "invalid";
}

/**
 * Reads a supplier stock sheet (shape of Mojoodi_4104070_*.xlsx): title rows, then a header row
 * with the four columns in STOCK_SHEET_HEADERS (in any order, other columns ignored), then data.
 * Row numbers in the result are the Excel row numbers (1-based), so staff can find them.
 */
export function parseStockSheetRows(rows: readonly (readonly unknown[])[]): StockSheet {
  const wanted = Object.entries(STOCK_SHEET_HEADERS).map(([k, v]) => [k, headerKey(v)] as const);
  const headerIndex = rows.findIndex((r) => {
    const keys = r.map(headerKey);
    return wanted.every(([, h]) => keys.includes(h));
  });
  if (headerIndex === -1) {
    return {
      ok: false,
      error: `ستون‌های «${Object.values(STOCK_SHEET_HEADERS).join("»، «")}» در فایل پیدا نشد.`,
    };
  }
  const keys = rows[headerIndex].map(headerKey);
  const col = Object.fromEntries(wanted.map(([k, h]) => [k, keys.indexOf(h)])) as Record<
    keyof typeof STOCK_SHEET_HEADERS,
    number
  >;

  const out: StockRow[] = [];
  const errors: StockRowError[] = [];
  const seen = new Set<string>();

  rows.slice(headerIndex + 1).forEach((r, i) => {
    const row = headerIndex + 2 + i;
    if (r.every((c) => cellText(c) === "")) return;
    const code = normalizeCode(cellText(r[col.code]));
    const name = cellText(r[col.name]);
    const car = normalizeName(cellText(r[col.car])) || null;
    const rial = cellRial(r[col.priceRial]);
    if (!code) return void errors.push({ row, code: "", reason: "کد فنی خالی است" });
    if (!isValidCode(code)) {
      return void errors.push({ row, code, reason: "کد فنی فقط می‌تواند حروف انگلیسی، عدد و نقطه داشته باشد" });
    }
    if (name.length < 2) return void errors.push({ row, code, reason: "نام قطعه خالی است" });
    if (rial === "invalid") return void errors.push({ row, code, reason: "قیمت نامعتبر است" });
    if (seen.has(code)) return void errors.push({ row, code, reason: "این کد در فایل تکراری است" });
    seen.add(code);
    out.push({ row, code, name, car, purchaseToman: rialToToman(rial) });
  });

  return { ok: true, rows: out, errors };
}

/** A real UUID (not just 36 dashes): ids from the URL are checked before they reach the database. */
export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

// ── Unit (piece / pair) ────────────────────────────────────────────────────────────────

export const units = ["piece", "pair"] as const;
export type Unit = (typeof units)[number];

export const UNIT_NAMES: Record<Unit, string> = { piece: "عدد", pair: "جفت" };

/** The small text next to a price: «قیمت یک عدد» / «قیمت یک جفت». */
export function unitPriceLabel(unit: Unit): string {
  return `قیمت یک ${UNIT_NAMES[unit]}`;
}

/** Most a shopper can put in the cart per product: 4 pieces or 2 pairs. More → the cart note. */
export function maxQuantity(unit: Unit): number {
  return unit === "pair" ? 2 : 4;
}

// ── Stock sheet: what an import changes (#2) ───────────────────────────────────────────

/** Per warehouse (set in «انبارها»): the sheet changes stock and prices, or only stock. */
export type SheetMode = "stock_and_price" | "stock_only";

/** A good already in the shop with one of the sheet's codes, or of the importing warehouse. */
export type ExistingGood = {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  purchasePriceToman: number | null;
  fromSheet: boolean;
  isUnavailable: boolean;
  unavailableSource: "hand" | "sheet" | null;
};

/** One purchase-price change from a sheet, shown to the manager (old → new). */
export type PriceChange = { id: string; code: string; name: string; oldToman: number | null; purchaseToman: number | null };

/**
 * How much a price moved: Toman (new − old) and percent of the old price, one decimal
 * (null when there was no old price or it was 0, or there is no new price).
 */
export function priceMove(oldToman: number | null, newToman: number | null): { amount: number | null; percent: number | null } {
  if (oldToman === null || newToman === null) return { amount: null, percent: null };
  const amount = newToman - oldToman;
  return { amount, percent: oldToman === 0 ? null : Math.round((amount * 1000) / oldToman) / 10 };
}

export type StockImportPlan = {
  /** Codes not in the shop yet: shown to the manager with a tick each. */
  newRows: StockRow[];
  /** The ticked new rows, with the price they get (none in «فقط موجودی»). */
  create: StockRow[];
  /** Goods of this warehouse found in the sheet (car links, «from sheet»). */
  matched: { id: string; row: StockRow }[];
  priceUpdates: PriceChange[];
  makeAvailable: { id: string; code: string; name: string }[];
  makeUnavailable: { id: string; code: string; name: string }[];
  skipped: StockRowError[];
  /** More than half of this warehouse's sheet goods would go «ناموجود»: ask «مطمئنی؟» first. */
  needsConfirm: boolean;
};

/**
 * Every code the supplier still lists: the good rows, plus rows rejected only for their name or
 * price (a row whose code itself is empty or wrong names no product).
 */
export function sheetCodes(rows: readonly StockRow[], rejected: readonly StockRowError[]): Set<string> {
  const codes = new Set(rows.map((r) => r.code));
  for (const e of rejected) if (e.code && isValidCode(e.code)) codes.add(e.code);
  return codes;
}

/**
 * What importing a stock sheet into one warehouse changes. Pure; the service writes it.
 * - A new code is created only when ticked (`selectedNew`); «فقط موجودی» creates it without price.
 * - A code of another warehouse is skipped.
 * - A good of this warehouse in the sheet: price updated (only «موجودی و قیمت»), available again
 *   if a sheet had made it «ناموجود» (never if staff did, by hand).
 * - A good of this warehouse that came from a sheet and is missing now → «ناموجود» (sheet).
 *   Goods made by hand and never in a sheet are left alone.
 */
export function planStockImport(input: {
  warehouseId: string;
  mode: SheetMode;
  rows: readonly StockRow[];
  existing: readonly ExistingGood[];
  selectedNew: ReadonlySet<string>;
  /** Codes rejected for another reason (bad name or price): still in the sheet, never «ناموجود». */
  rejected?: readonly StockRowError[];
}): StockImportPlan {
  const { warehouseId, mode, rows, existing, selectedNew } = input;
  const byCode = new Map(existing.map((g) => [g.code, g]));
  const inSheet = sheetCodes(rows, input.rejected ?? []);
  const plan: StockImportPlan = {
    newRows: [],
    create: [],
    matched: [],
    priceUpdates: [],
    makeAvailable: [],
    makeUnavailable: [],
    skipped: [],
    needsConfirm: false,
  };

  for (const r of rows) {
    const g = byCode.get(r.code);
    if (!g) {
      plan.newRows.push(r);
      if (selectedNew.has(r.code)) plan.create.push(mode === "stock_only" ? { ...r, purchaseToman: null } : r);
      continue;
    }
    if (g.warehouseId !== warehouseId) {
      plan.skipped.push({ row: r.row, code: r.code, reason: "این کد در انبار دیگری ثبت شده است" });
      continue;
    }
    plan.matched.push({ id: g.id, row: r });
    if (mode === "stock_and_price" && g.purchasePriceToman !== r.purchaseToman) {
      plan.priceUpdates.push({ id: g.id, code: g.code, name: g.name, oldToman: g.purchasePriceToman, purchaseToman: r.purchaseToman });
    }
    if (g.isUnavailable && g.unavailableSource === "sheet") plan.makeAvailable.push({ id: g.id, code: g.code, name: g.name });
  }

  const sheetGoods = existing.filter((g) => g.warehouseId === warehouseId && g.fromSheet);
  for (const g of sheetGoods) {
    if (!inSheet.has(g.code) && !g.isUnavailable) plan.makeUnavailable.push({ id: g.id, code: g.code, name: g.name });
  }
  plan.needsConfirm = sheetGoods.length > 0 && plan.makeUnavailable.length > sheetGoods.length / 2;
  return plan;
}
