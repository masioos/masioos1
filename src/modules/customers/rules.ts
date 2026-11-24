import { z } from "zod";
import { isMobile, normalizeMobile } from "@/lib/mobile";

// Pure rules of the customers module: no DB, no React. Tests live next to this file.

export { isMobile, normalizeMobile, safeNextPath } from "@/lib/mobile";

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
