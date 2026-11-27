import { z } from "zod";
import { cardHolderSchema, cardNumberSchema, toAsciiDigits } from "@/lib/card";

// Pure rules of the warehouses module: no DB, no React. Tests live next to this file.

export { normalizeCardNumber } from "@/lib/card";

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

/** Empty means 0% (the box shows a faint «0»). */
export const profitPercentSchema = z
  .string()
  .transform((s) => (s.trim() === "" ? "0" : s))
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
  cardNumber: cardNumberSchema,
  // The name on the card: shown to shoppers who pay by card-to-card. Not always the owner.
  cardHolder: cardHolderSchema,
  profitBp: profitPercentSchema,
});

export type NewWarehouse = z.infer<typeof newWarehouseSchema>;

/** The manager corrects a warehouse's card (number and the name on it). */
export const setCardSchema = z.object({
  id: z.uuid(),
  cardNumber: cardNumberSchema,
  cardHolder: cardHolderSchema,
});

/** The manager fixes a warehouse's name or owner in the list (saves by itself). */
export const setInfoSchema = z.object({
  id: z.uuid(),
  name: newWarehouseSchema.shape.name,
  ownerName: newWarehouseSchema.shape.ownerName,
});

/** ▲ ▼ in the list: one place up or down. */
export const moveSchema = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) });

/** The list order after moving one warehouse one place (unchanged at the top / bottom). */
export function moveInOrder(ids: readonly string[], id: string, direction: "up" | "down"): string[] {
  const order = [...ids];
  const i = order.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return order;
  [order[i], order[j]] = [order[j], order[i]];
  return order;
}

/** «RF»: 1–5 English letters, upper case; empty = none. */
export const codePrefixSchema = z.object({
  id: z.uuid(),
  codePrefix: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{0,5}$/, "کد انبار فقط ۱ تا ۵ حرف انگلیسی است، مثل RF"))
    .transform((s) => s || null),
});

export const setProfitSchema = z.object({
  id: z.uuid(),
  profitBp: profitPercentSchema,
});
