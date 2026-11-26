import { z } from "zod";

// Bank card numbers as typed by people (warehouse cards, an order's payee card). Pure.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian/Arabic digits → ASCII. Other characters stay. */
export function toAsciiDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** Turns Persian/Arabic digits into ASCII and drops spaces and dashes: "۶۰۳۷-۹۹..." → "603799...". */
export function normalizeCardNumber(input: string): string {
  return toAsciiDigits(input).replace(/[\s-]/g, "");
}

export const cardNumberSchema = z
  .string()
  .transform(normalizeCardNumber)
  .pipe(z.string().regex(/^\d{16}$/, "شماره کارت باید ۱۶ رقم باشد"));

export const cardHolderSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(3, "نام صاحب کارت را کامل بنویسید").max(100, "نام صاحب کارت خیلی بلند است"));

/** «6037 9975 1234 5678» — groups of four, for showing a card (left to right). */
export function groupCard(card: string): string {
  return card.replace(/(\d{4})(?=\d)/g, "$1 ");
}
