import { z } from "zod";

// Pure rules of the customers module: no DB, no React. Tests live next to this file.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * An Iranian mobile as typed → "09xxxxxxxxx". Accepts Persian digits, spaces, dashes and the
 * +98 / 0098 / 98 prefixes. Returns the text unchanged-ish when it is not a mobile (the schema refuses it).
 */
export function normalizeMobile(input: string): string {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\s\-()+]/g, "");
  if (/^0098\d{10}$/.test(digits)) return `0${digits.slice(4)}`;
  if (/^98\d{10}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

export function isMobile(mobile: string): boolean {
  return /^09\d{9}$/.test(mobile);
}

const mobile = z
  .string()
  .transform(normalizeMobile)
  .pipe(z.string().refine(isMobile, "شماره همراه درست نیست. مثال: 09121234567"));

const password = z.string().min(6, "رمز باید حداقل ۶ حرف یا عدد باشد").max(100, "رمز خیلی بلند است");

export const registerSchema = z.object({
  fullName: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(3, "نام و نام خانوادگی را کامل بنویسید").max(100)),
  mobile,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .pipe(z.email("ایمیل درست نیست").nullable()),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  mobile,
  password: z.string().min(1, "رمز را بنویسید"),
});

export const setPasswordSchema = z.object({
  customerId: z.uuid(),
  password,
});

export const addressSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(10, "آدرس را کامل بنویسید (شهر، خیابان، پلاک)").max(500, "آدرس خیلی بلند است"));

/** Only same-site paths after sign-in, so a link cannot send the shopper to another website. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
