import { z } from "zod";

// Pure rules of the requests module: no DB, no React. Tests live next to this file.

export type Unit = "piece" | "pair";

/** Most a shopper can put in the cart per product: 4 pieces or 2 pairs (same as catalog.maxQuantity). */
export function maxQuantity(unit: Unit): number {
  return unit === "pair" ? 2 : 4;
}

/** A wanted quantity → 1..max for the unit. */
export function clampQuantity(wanted: number, unit: Unit): number {
  if (!Number.isFinite(wanted)) return 1;
  return Math.min(maxQuantity(unit), Math.max(1, Math.floor(wanted)));
}

// ── Cart ───────────────────────────────────────────────────────────────────────────────

export type CartLine = {
  productId: string;
  quantity: number;
  unit: Unit;
  shopPriceToman: number | null;
  isActive: boolean;
  isUnavailable: boolean;
};

/** Sum of price × quantity, whole Toman. Lines without a price are counted in `hasUnpriced`. */
export function cartTotal(lines: readonly CartLine[]): { total: number; hasUnpriced: boolean } {
  let total = 0;
  let hasUnpriced = false;
  for (const l of lines) {
    if (l.shopPriceToman === null) hasUnpriced = true;
    else total += l.shopPriceToman * l.quantity;
  }
  return { total, hasUnpriced };
}

/** A line that can no longer be bought: the product became inactive or unavailable. */
export function isProblemLine(l: Pick<CartLine, "isActive" | "isUnavailable">): boolean {
  return !l.isActive || l.isUnavailable;
}

export type SubmitCheck = { ok: true } | { ok: false; error: string };

/** The cart can be sent: no flagged lines, and at least one line or a note. */
export function canSubmit(lines: readonly CartLine[], note: string): SubmitCheck {
  if (lines.some(isProblemLine)) {
    return { ok: false, error: "بعضی کالاهای سبد دیگر موجود نیستند. اول آن‌ها را از سبد بردارید." };
  }
  if (lines.length === 0 && note.trim() === "") {
    return { ok: false, error: "سبد خالی است. کالایی اضافه کنید یا در کادر توضیحات بنویسید چه می‌خواهید." };
  }
  return { ok: true };
}

export const NOTE_MAX = 2000;

export const noteSchema = z.string().trim().max(NOTE_MAX, "متن توضیحات خیلی بلند است");

// ── Requests ───────────────────────────────────────────────────────────────────────────

export type StoredStatus = "awaiting" | "confirmed" | "accepted" | "cancelled" | "rejected" | "declined";
export type Status = StoredStatus | "expired";

export const STATUS_NAMES: Record<Status, string> = {
  awaiting: "در انتظار تأیید فروشگاه",
  confirmed: "تأیید شده، منتظر پاسخ شما",
  accepted: "پذیرفته شده",
  cancelled: "لغو شده",
  rejected: "رد شده",
  declined: "انصراف داده شده",
  expired: "منقضی شده",
};

/** Staff see the same states in their own words. */
export const STAFF_STATUS_NAMES: Record<Status, string> = {
  ...STATUS_NAMES,
  awaiting: "در انتظار تأیید مدیر",
  confirmed: "تأیید شده، منتظر پاسخ مشتری",
  cancelled: "لغو شده توسط مشتری",
  declined: "انصراف مشتری",
};

/** A confirmed request whose deadline has passed is expired. */
export function effectiveStatus(r: { status: StoredStatus; deadlineAt: Date | null }, now: Date): Status {
  if (r.status === "confirmed" && r.deadlineAt && r.deadlineAt.getTime() <= now.getTime()) return "expired";
  return r.status;
}

export type Action =
  | "cancel"
  | "accept"
  | "decline"
  | "staffEdit"
  | "confirm"
  | "reject"
  | "message"
  | "shopperMessage"
  | "reopen";

/** Who may do what, in which status. Everything not listed is refused. */
const ALLOWED: Record<Action, readonly Status[]> = {
  cancel: ["awaiting"], // shopper, before staff confirm
  accept: ["confirmed"], // shopper, before the deadline
  decline: ["confirmed"], // shopper
  staffEdit: ["awaiting"], // staff change rows only before confirming
  confirm: ["awaiting"],
  reject: ["awaiting", "confirmed"], // never after the shopper accepted
  message: ["awaiting", "confirmed", "accepted"],
  shopperMessage: ["awaiting", "confirmed", "accepted"],
  // Staff «ویرایش فاکتور»: back to awaiting, so the shopper must accept the new invoice again.
  reopen: ["confirmed", "expired", "accepted"],
};

export function canDo(action: Action, status: Status): boolean {
  return ALLOWED[action].includes(status);
}

export type Row = { quantity: number; priceToman: number | null; isUnavailable: boolean; discountPercent?: number };

export const MAX_DISCOUNT_PERCENT = 100;

/** One row's amount: price × quantity less the row's discount, rounded to whole Toman. */
export function rowTotal(r: { quantity: number; priceToman: number; discountPercent?: number }): number {
  const d = r.discountPercent ?? 0;
  return Math.round((r.priceToman * r.quantity * (100 - d)) / 100);
}

/** Request total: rowTotal of rows not marked unavailable. Whole Toman. */
export function requestTotal(rows: readonly Row[]): { total: number; hasUnpriced: boolean } {
  let total = 0;
  let hasUnpriced = false;
  for (const r of rows) {
    if (r.isUnavailable) continue;
    if (r.priceToman === null) hasUnpriced = true;
    else total += rowTotal({ ...r, priceToman: r.priceToman });
  }
  return { total, hasUnpriced };
}

export type ProfitRow = Row & { purchasePriceToman?: number | null; manualProfitToman?: number | null };

/**
 * Staff only: a row's profit = its amount after the row discount − purchase price × quantity.
 * A row with no purchase price (a free row) uses the profit staff typed for it.
 * null when it cannot be known, or the row is unavailable.
 */
export function rowProfit(r: ProfitRow): number | null {
  if (r.isUnavailable) return null;
  if (r.purchasePriceToman == null) return r.manualProfitToman ?? null;
  if (r.priceToman === null) return null;
  return rowTotal({ ...r, priceToman: r.priceToman }) - r.purchasePriceToman * r.quantity;
}

/** Profit of the invoice: rows' profits less the whole-invoice discount. `incomplete` = some row's profit is unknown. */
export function profitTotal(
  rows: readonly ProfitRow[],
  invoiceDiscount: number,
): { total: number; incomplete: boolean } {
  let total = 0;
  let incomplete = false;
  for (const r of rows) {
    if (r.isUnavailable) continue;
    const p = rowProfit(r);
    if (p === null) incomplete = true;
    else total += p;
  }
  return { total: total - invoiceDiscount, incomplete };
}

export type DiscountKind = "none" | "percent" | "amount";

export type InvoiceTotals = {
  /** Rows after their own discounts. */
  subtotal: number;
  /** The whole-invoice discount in Toman (never more than the subtotal). */
  discount: number;
  total: number;
  hasUnpriced: boolean;
};

/** The «تعداد» total under the invoice: units of the rows that are not unavailable. */
export function quantityTotal(rows: readonly { quantity: number; isUnavailable: boolean }[]): number {
  return rows.reduce((n, r) => (r.isUnavailable ? n : n + r.quantity), 0);
}

/** Request total with the whole-invoice discount: a percent of the rows' sum, or a fixed amount. */
export function invoiceTotals(rows: readonly Row[], d: { kind: DiscountKind; value: number }): InvoiceTotals {
  const { total: subtotal, hasUnpriced } = requestTotal(rows);
  const raw = d.kind === "percent" ? Math.round((subtotal * d.value) / 100) : d.kind === "amount" ? d.value : 0;
  const discount = Math.min(Math.max(raw, 0), subtotal);
  return { subtotal, discount, total: subtotal - discount, hasUnpriced };
}

/** Staff can confirm only when at least one row remains and every remaining row has a price. */
export function canConfirm(rows: readonly Row[]): SubmitCheck {
  const live = rows.filter((r) => !r.isUnavailable);
  if (live.length === 0) return { ok: false, error: "هیچ ردیف موجودی نمانده است. اگر کالایی نیست، درخواست را رد کنید." };
  if (live.some((r) => r.priceToman === null)) return { ok: false, error: "برای همه‌ی ردیف‌ها قیمت بگذارید." };
  return { ok: true };
}

export const DEFAULT_DEADLINE_HOURS = 12;
export const MAX_DEADLINE_HOURS = 168;

/** Confirmation deadline: staff's hours (1–168), or 12 when left empty. */
export function deadlineFrom(hours: number | null, now: Date): Date {
  const h = hours ?? DEFAULT_DEADLINE_HOURS;
  return new Date(now.getTime() + h * 60 * 60 * 1000);
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toAscii = (s: string) => s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));

/** Reads a whole number typed by staff (Persian digits and separators allowed). "" → null. */
function wholeNumber(s: string): number | null | "invalid" {
  const t = toAscii(s).replace(/[,،٬/\s]/g, "");
  if (t === "") return null;
  // A leading minus («-» or «−») is a negative number; only boxes whose min is below 0 accept it.
  const m = /^([-−]?)(\d{1,13})$/.exec(t);
  return m ? (m[1] ? -Number(m[2]) : Number(m[2])) : "invalid";
}

const optionalWhole = (message: string, min: number, max: number) =>
  z
    .string()
    .default("")
    .transform((s, ctx) => {
      const n = wholeNumber(s);
      if (n === "invalid" || (n !== null && (n < min || n > max))) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

export const confirmSchema = z.object({
  requestId: z.uuid(),
  hours: optionalWhole(`مهلت باید بین ۱ و ${MAX_DEADLINE_HOURS} ساعت باشد`, 1, MAX_DEADLINE_HOURS),
  message: z.string().trim().max(2000).default(""),
});

export const rowEditSchema = z.object({
  rowId: z.uuid(),
  priceToman: optionalWhole("قیمت باید یک عدد مثبت به تومان باشد", 1, 1_000_000_000_000),
  quantity: optionalWhole("تعداد باید بین ۱ و ۹۹۹ باشد", 1, 999).pipe(
    z.number({ error: "تعداد را بنویسید" }),
  ),
  isUnavailable: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  discountPercent: optionalWhole(`تخفیف باید بین ۰ و ${MAX_DISCOUNT_PERCENT} درصد باشد`, 0, MAX_DISCOUNT_PERCENT).transform(
    (n) => n ?? 0,
  ),
  // Only rows with no purchase price send it; empty = not known yet.
  manualProfitToman: optionalWhole("پرافیت باید یک عدد به تومان باشد (ضرر با منفی)", -1_000_000_000_000, 1_000_000_000_000),
});

export const addRowSchema = z
  .object({
    requestId: z.uuid(),
    code: z.string().trim().max(40).default(""),
    name: z.string().trim().max(300).default(""),
    priceToman: optionalWhole("قیمت باید یک عدد مثبت به تومان باشد", 1, 1_000_000_000_000),
    quantity: optionalWhole("تعداد باید بین ۱ و ۹۹۹ باشد", 1, 999),
    // For a free row; a catalog product keeps its own unit.
    unit: z.enum(["piece", "pair"]).default("piece"),
  })
  .refine((v) => v.code !== "" || v.name.length >= 2, { message: "کد فنی کالا یا نام ردیف را بنویسید" });

/** The «تخفیف» box beside the invoice total. Unticked = no discount. */
export const invoiceDiscountSchema = z
  .object({
    requestId: z.uuid(),
    enabled: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    kind: z.enum(["percent", "amount"]).default("percent"),
    value: optionalWhole("مقدار تخفیف درست نیست", 0, 1_000_000_000_000).transform((n) => n ?? 0),
  })
  .refine((v) => !v.enabled || v.kind !== "percent" || v.value <= MAX_DISCOUNT_PERCENT, {
    message: `تخفیف درصدی باید بین ۰ و ${MAX_DISCOUNT_PERCENT} باشد`,
  })
  .transform((v) => ({
    requestId: v.requestId,
    kind: (v.enabled ? v.kind : "none") as DiscountKind,
    value: v.enabled ? v.value : 0,
  }));

export const requestIdSchema = z.object({ requestId: z.uuid() });

export const messageSchema = z.object({
  requestId: z.uuid(),
  message: z.string().trim().min(1, "متن پیام را بنویسید").max(2000, "پیام خیلی بلند است"),
});

/** Reject uses the same box as messages: what staff wrote there is the reason. */
export const rejectSchema = z.object({
  requestId: z.uuid(),
  message: z.string().trim().min(3, "برای رد، دلیل را در کادر پیام بنویسید").max(2000),
});

// ── Staff list tabs ────────────────────────────────────────────────────────────────────

export type StaffTab = "new" | "working" | "paid" | "void" | "all";

export const STAFF_TABS: readonly { tab: StaffTab; name: string }[] = [
  { tab: "new", name: "تازه" },
  { tab: "working", name: "در حال انجام" },
  { tab: "paid", name: "پرداخت شده" },
  { tab: "void", name: "باطل شده" },
  { tab: "all", name: "همه" },
];

export function parseStaffTab(v: unknown): StaffTab {
  return STAFF_TABS.some((t) => t.tab === v) ? (v as StaffTab) : "new";
}

/**
 * Which tab a request sits in (besides «همه»):
 * new = awaiting and never opened by staff; working = opened, awaiting or confirmed;
 * paid = the shopper accepted (no payment gateway yet, so «accepted» stands for paid);
 * void = rejected, cancelled, declined or expired.
 */
export function staffTabOf(r: { status: Status; staffSeenAt: Date | null }): Exclude<StaffTab, "all"> {
  switch (r.status) {
    case "awaiting":
      return r.staffSeenAt === null ? "new" : "working";
    case "confirmed":
      return "working";
    case "accepted":
      return "paid";
    default:
      return "void";
  }
}

/** Purchase price and profit are staff-only: blank them before a request reaches a shopper. */
export function hideStaffOnly<T extends { purchasePriceToman: number | null; manualProfitToman: number | null }>(
  rows: readonly T[],
): T[] {
  return rows.map((x) => ({ ...x, purchasePriceToman: null, manualProfitToman: null }));
}
