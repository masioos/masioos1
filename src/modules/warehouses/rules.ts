import { z } from "zod";

// Pure rules of the warehouses module: no DB, no React. Tests live next to this file.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Turns Persian/Arabic digits into ASCII and drops spaces and dashes: "۶۰۳۷-۹۹..." → "603799...". */
export function normalizeCardNumber(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\s-]/g, "");
}

export const newWarehouseSchema = z.object({
  name: z.string().trim().min(2, "نام انبار حداقل ۲ حرف است"),
  ownerName: z.string().trim().min(2, "نام صاحب انبار حداقل ۲ حرف است"),
  cardNumber: z
    .string()
    .transform(normalizeCardNumber)
    .pipe(z.string().regex(/^\d{16}$/, "شماره کارت باید ۱۶ رقم باشد")),
});

export type NewWarehouse = z.infer<typeof newWarehouseSchema>;
