import { z } from "zod";

// Pure rules of the settings module. Tests live next to this file.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** A phone number as staff type it → ASCII digits only. «۰۲۱-۱۲۳۴ ۵۶۷۸» → "02112345678". */
export function normalizePhone(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/^\+98/, "0")
    .replace(/[\s\-()]/g, "");
}

export const supportPhoneSchema = z.object({
  supportPhone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^0\d{10}$/, "شماره باید ۱۱ رقم باشد و با ۰ شروع شود، مثل 09121234567")),
});

/** Shown with a dash for readability: "09121234567" → "0912-123-4567"; landline "021-1234-5678". */
export function formatPhone(phone: string): string {
  if (/^09\d{9}$/.test(phone)) return `${phone.slice(0, 4)}-${phone.slice(4, 7)}-${phone.slice(7)}`;
  if (/^0\d{10}$/.test(phone)) return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  return phone;
}
