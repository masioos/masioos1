import { z } from "zod";

// Pure rules of the warehouses module: no DB, no React. Tests live next to this file.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian/Arabic digits → ASCII. Other characters stay. */
function toAsciiDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** Turns Persian/Arabic digits into ASCII and drops spaces and dashes: "۶۰۳۷-۹۹..." → "603799...". */
export function normalizeCardNumber(input: string): string {
  return toAsciiDigits(input).replace(/[\s-]/g, "");
}

/**
 * Profit percent typed by staff → basis points (1% = 100 bp). Integer math only, no floats.
 * Accepts Persian digits, the Persian decimal mark «٫», an optional «%». 0–100, up to 2 decimals.
 * "۱۰" → 1000, "12.5" → 1250. Returns null when the text is not such a number.
 */
export function parseProfitPercent(input: string): number | null {
  const text = toAsciiDigits(input).replace(/[٫/]/g, ".").replace(/[%٪\s]/g, "");
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bp <= 10_000 ? bp : null;
}

/** Basis points → percent text for a form field: 1250 → "12.5", 1000 → "10". */
export function formatProfitPercent(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = String(bp % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

export const profitPercentSchema = z
  .string()
  .transform((s, ctx) => {
    const bp = parseProfitPercent(s);
    if (bp === null) {
      ctx.addIssue({ code: "custom", message: "درصد سود باید عددی بین ۰ و ۱۰۰ باشد" });
      return z.NEVER;
    }
    return bp;
  });

export const newWarehouseSchema = z.object({
  name: z.string().trim().min(2, "نام انبار حداقل ۲ حرف است"),
  ownerName: z.string().trim().min(2, "نام صاحب انبار حداقل ۲ حرف است"),
  cardNumber: z
    .string()
    .transform(normalizeCardNumber)
    .pipe(z.string().regex(/^\d{16}$/, "شماره کارت باید ۱۶ رقم باشد")),
  profitBp: profitPercentSchema,
});

export type NewWarehouse = z.infer<typeof newWarehouseSchema>;

export const setProfitSchema = z.object({
  id: z.uuid(),
  profitBp: profitPercentSchema,
});
