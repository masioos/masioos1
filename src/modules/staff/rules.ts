import { z } from "zod";
import { isMobile, normalizeMobile } from "@/lib/mobile";

// Pure rules of the staff module: roles, permissions, passwords. No DB, no React. Tests next to it.

export type StaffRole = "manager" | "seller";

/** A session ends after this many hours with no activity. */
export const IDLE_HOURS = 6;

export type StaffViewer = {
  role: StaffRole;
  canSeePurchasePrice: boolean;
  canSeeProfit: boolean;
};

/** Numbers a seller sees only when the manager allowed that one for them. */
export type Secret = "purchasePrice" | "profit";

export function canSee(viewer: StaffViewer, what: Secret): boolean {
  if (viewer.role === "manager") return true;
  return what === "purchasePrice" ? viewer.canSeePurchasePrice : viewer.canSeeProfit;
}

/** Work only the manager does. Sellers do all request work, which needs no ability here. */
export type Ability = "manageStaff" | "settings" | "warehouses" | "editProducts";

const MANAGER_ONLY: readonly Ability[] = ["manageStaff", "settings", "warehouses", "editProducts"];

export function can(viewer: { role: StaffRole }, ability: Ability): boolean {
  return viewer.role === "manager" || !MANAGER_ONLY.includes(ability);
}

/** Wrong passwords for one mobile within LOCK_MINUTES that close sign-in for that mobile. */
export const MAX_FAILED_SIGN_INS = 5;
export const LOCK_MINUTES = 15;

/** Sign-in with this mobile is closed while it has this many recent wrong passwords. */
export function isLocked(recentFailures: number): boolean {
  return recentFailures >= MAX_FAILED_SIGN_INS;
}

export const LOCKED_MESSAGE = `به خاطر چند رمز اشتباه، ورود با این شماره ${LOCK_MINUTES.toLocaleString("fa-IR")} دقیقه بسته است. بعداً دوباره امتحان کنید.`;

/** No 0/o or 1/l, so a password read out on the phone is not misheard. */
export const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const PASSWORD_LENGTH = 10;

/** A new random password the manager reads out to a seller. */
export function newPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
  // 256 is a multiple of 32 (the alphabet size), so every letter is equally likely.
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

const mobile = z
  .string()
  .transform(normalizeMobile)
  .pipe(z.string().refine(isMobile, "شماره همراه درست نیست. مثال: 09121234567"));

export const staffLoginSchema = z.object({
  mobile,
  password: z.string().min(1, "رمز را بنویسید"),
});

export const addSellerSchema = z.object({
  fullName: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(3, "نام و نام خانوادگی را کامل بنویسید").max(100, "نام خیلی بلند است")),
  mobile,
});

export const staffIdSchema = z.object({ staffId: z.uuid() });

/** The manager fixes a seller's name or mobile. */
export const editSellerSchema = addSellerSchema.extend({ staffId: z.uuid() });

export const switchSchema = z.object({
  staffId: z.uuid(),
  which: z.enum(["active", "purchasePrice", "profit"]),
  on: z.enum(["true", "false"]).transform((v) => v === "true"),
});
