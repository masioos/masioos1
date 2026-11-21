import { z } from "zod";

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
  return `${toman.toLocaleString("fa-IR")} تومان`;
}

/** Reads a price typed by staff: Persian digits and thousands separators allowed. "" → null. */
export function parsePriceText(input: string): number | null | "invalid" {
  const text = toAsciiDigits(input).replace(/[,،٬\s]/g, "");
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return "invalid";
  const n = Number(text);
  return n <= MAX_PRICE_TOMAN ? n : "invalid";
}

/** 1,000 billion Toman: far above any part, and small enough that price × profit stays exact. */
export const MAX_PRICE_TOMAN = 1_000_000_000_000;

// ── Text ───────────────────────────────────────────────────────────────────────────────

/**
 * One form for searching: Arabic ي/ك → Persian ی/ک, Persian/Arabic digits → ASCII,
 * ZWNJ (half-space) → space, Latin lower-case, spaces collapsed. Used on stored text and on queries.
 */
export function normalizeSearch(input: string): string {
  return toAsciiDigits(input)
    .replace(/[يى]/g, "ی")
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

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS_PER_PRODUCT = 6;

/** Only names this app wrote: "<uuid>.<jpg|png|webp>". Blocks path tricks like "../.env". */
export function isSafePhotoName(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(name);
}

/** The real image type from the file's first bytes (never trust the browser's label). */
export function detectImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

export const PHOTO_CONTENT_TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

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
