import { z } from "zod";
import { cardHolderSchema, cardNumberSchema } from "@/lib/card";
import { isSafePhotoName } from "@/lib/image";

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

/**
 * After «قبول» the request is an order (#19): accepted = awaiting payment → payment_sent (the shopper
 * sent the payment form) → paid → collecting → shipped; refunded after payment.
 */
export type StoredStatus =
  | "awaiting"
  | "confirmed"
  | "accepted"
  | "cancelled"
  | "rejected"
  | "declined"
  | "payment_sent"
  | "paid"
  | "collecting"
  | "shipped"
  | "refunded";
export type Status = StoredStatus | "expired";

export const STATUS_NAMES: Record<Status, string> = {
  awaiting: "در انتظار تأیید فروشگاه",
  confirmed: "تأیید شده، منتظر پاسخ شما",
  accepted: "منتظر پرداخت",
  cancelled: "لغو شده",
  rejected: "رد شده",
  declined: "انصراف داده شده",
  expired: "منقضی شده",
  payment_sent: "پرداخت فرستاده شد، در انتظار بررسی",
  paid: "پرداخت تأیید شد",
  collecting: "در حال جمع‌آوری",
  shipped: "ارسال شد",
  refunded: "لغو و برگشت پول",
};

/** Staff see the same states in their own words. */
export const STAFF_STATUS_NAMES: Record<Status, string> = {
  ...STATUS_NAMES,
  awaiting: "در انتظار تأیید مدیر",
  confirmed: "تأیید شده، منتظر پاسخ مشتری",
  accepted: "منتظر پرداخت مشتری",
  cancelled: "لغو شده توسط مشتری",
  declined: "انصراف مشتری",
  payment_sent: "پرداخت فرستاده شد، منتظر بررسی",
};

/**
 * Past the deadline: a confirmed request the shopper did not answer, or an accepted one with no
 * payment form yet, is expired. Once a payment form has arrived the deadline no longer applies.
 */
export function effectiveStatus(
  r: { status: StoredStatus; deadlineAt: Date | null; paymentFormAt?: Date | null },
  now: Date,
): Status {
  const late = !!r.deadlineAt && r.deadlineAt.getTime() <= now.getTime();
  if (late && r.status === "confirmed") return "expired";
  if (late && r.status === "accepted" && !r.paymentFormAt) return "expired";
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
  | "reopen"
  | "pay"
  | "setPayee"
  | "confirmPayment"
  | "paymentNotFound"
  | "collect"
  | "ship"
  | "refund"
  | "setDelivery"
  | "shippingCode"
  | "addRefund";

/** Statuses where the request is alive and messages go both ways. */
const OPEN: readonly Status[] = ["awaiting", "confirmed", "accepted", "payment_sent", "paid", "collecting", "shipped"];

/** Who may do what, in which status. Everything not listed is refused. */
const ALLOWED: Record<Action, readonly Status[]> = {
  cancel: ["awaiting"], // shopper, before staff confirm
  accept: ["confirmed"], // shopper, before the deadline
  decline: ["confirmed"], // shopper
  staffEdit: ["awaiting"], // staff change rows only before confirming
  confirm: ["awaiting"],
  reject: ["awaiting", "confirmed"], // never after the shopper accepted
  message: OPEN,
  shopperMessage: OPEN,
  // Staff «ویرایش فاکتور»: back to awaiting, so the shopper must accept the new invoice again.
  // Refused once a payment form has arrived (`beforePayment`).
  reopen: ["confirmed", "expired", "accepted"],
  // Shopper sends a payment form; with several cards also while an earlier one waits for staff.
  pay: ["accepted", "payment_sent"],
  // Staff change the payee card; also refused once a payment form has arrived.
  setPayee: ["awaiting", "confirmed", "accepted"],
  confirmPayment: ["payment_sent"],
  paymentNotFound: ["payment_sent"],
  collect: ["paid"],
  ship: ["collecting"],
  // «لغو و برگشت پول». From accepted only once a payment form came (`canCancelOrder`): e.g. every form
  // was «پیدا نشد», or part was confirmed, and the shopper is gone.
  refund: ["accepted", "paid", "collecting", "shipped"],
  // Shopper picks the delivery method once, before paying; may change it until the payment is confirmed.
  setDelivery: ["accepted", "payment_sent"],
  // Staff type the parcel tracking code (saves by itself) before and after «ارسال شد».
  shippingCode: ["paid", "collecting", "shipped"],
  // Staff record money sent back (partial or after «لغو و برگشت پول»), never more than was confirmed.
  // Not while the shopper is still paying: refunds do not lower what is left to pay.
  addRefund: ["paid", "collecting", "shipped", "refunded"],
};

/** «لغو و برگشت پول»: after payment, or an accepted order that already had a payment form. */
export function canCancelOrder(status: Status, paymentFormAt: Date | null): boolean {
  return canDo("refund", status) && (status !== "accepted" || paymentFormAt !== null);
}

/** «ویرایش فاکتور» and a new payee card are allowed only until the first payment form arrives. */
export function beforePayment(r: { paymentFormAt: Date | null }): boolean {
  return r.paymentFormAt === null;
}

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
 * new = awaiting and never opened by staff; working = opened awaiting, confirmed, awaiting payment,
 * payment sent; paid = payment confirmed, collecting, shipped;
 * void = rejected, cancelled, declined, expired (also unpaid past the deadline) or refunded.
 */
export function staffTabOf(r: { status: Status; staffSeenAt: Date | null }): Exclude<StaffTab, "all"> {
  switch (r.status) {
    case "awaiting":
      return r.staffSeenAt === null ? "new" : "working";
    case "confirmed":
    case "accepted":
    case "payment_sent":
      return "working";
    case "paid":
    case "collecting":
    case "shipped":
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

// ── Request history (تاریخچه) ─────────────────────────────────────────────────────────

export type HistoryKind =
  | "confirm"
  | "reject"
  | "reopen"
  | "edit"
  | "payee_card"
  | "payment_confirmed"
  | "payment_not_found"
  | "collecting"
  | "shipped"
  | "refunded"
  | "refund_paid";

/** One history line under the invoice: «<time> — <name>: تأیید کرد». */
export const HISTORY_LABELS: Record<HistoryKind, string> = {
  confirm: "تأیید کرد",
  reject: "رد کرد",
  reopen: "ویرایش فاکتور",
  edit: "ویرایش کرد",
  payee_card: "کارت مقصد را عوض کرد",
  payment_confirmed: "پرداخت را تأیید کرد",
  payment_not_found: "پرداخت پیدا نشد",
  collecting: "در حال جمع‌آوری",
  shipped: "ارسال کرد",
  refunded: "لغو و برگشت پول",
  refund_paid: "پول برگرداند",
};

/** «آخرین کار» on the sellers page, e.g. «فاکتور ۶ را تأیید کرد». */
export function historyNote(kind: HistoryKind, requestNumber: number): string {
  const n = requestNumber.toLocaleString("fa-IR", { useGrouping: false });
  const verb: Record<HistoryKind, string> = {
    confirm: "را تأیید کرد",
    reject: "را رد کرد",
    reopen: "را برای ویرایش باز کرد",
    edit: "را ویرایش کرد",
    payee_card: "کارت مقصد را عوض کرد",
    payment_confirmed: "پرداخت را تأیید کرد",
    payment_not_found: "پرداخت را پیدا نکرد",
    collecting: "را در حال جمع‌آوری گذاشت",
    shipped: "را ارسال کرد",
    refunded: "را لغو کرد و پول را برگرداند",
    refund_paid: "پول برگرداند",
  };
  // «فاکتور ۶ را تأیید کرد», «فاکتور ۶: کارت مقصد را عوض کرد»
  return verb[kind].startsWith("را ") ? `فاکتور ${n} ${verb[kind]}` : `فاکتور ${n}: ${verb[kind]}`;
}

// ── Payment (card-to-card, #19) ────────────────────────────────────────────────────────

export type DeliveryMethod = "tipax" | "post" | "courier" | "pickup";

export const DELIVERY_NAMES: Record<DeliveryMethod, string> = {
  tipax: "تیپاکس",
  post: "پست",
  courier: "پیک (داخل شهر)",
  pickup: "تحویل حضوری از مغازه",
};

/** Tipax and post parcels get a tracking code when shipped; courier and pickup do not. */
export function needsTrackingCode(method: DeliveryMethod | null): boolean {
  return method === "tipax" || method === "post";
}

export const PAY_ON_DELIVERY_NOTE = "هزینه ارسال به عهده مشتری (پس‌کرایه)";

export type PayeeRow = Row & { warehouseId: string | null };
export type WarehouseCard = { id: string; cardNumber: string; cardHolder: string };

/**
 * The suggested payee card: the warehouse with the largest share of the invoice (row amounts after
 * row discounts; unavailable and unpriced rows do not count). A tie → the warehouse of the earlier
 * row. null when no row has a warehouse with a card.
 */
export function defaultPayee(rows: readonly PayeeRow[], cards: readonly WarehouseCard[]): WarehouseCard | null {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const share = new Map<string, number>();
  for (const r of rows) {
    if (r.isUnavailable || r.priceToman === null || !r.warehouseId || !byId.has(r.warehouseId)) continue;
    share.set(r.warehouseId, (share.get(r.warehouseId) ?? 0) + rowTotal({ ...r, priceToman: r.priceToman }));
  }
  let best: string | null = null;
  // Map keeps first-seen order, so on a tie the earlier row's warehouse stays.
  for (const [id, amount] of share) if (best === null || amount > (share.get(best) ?? 0)) best = id;
  return best ? (byId.get(best) ?? null) : null;
}

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000; // Iran has no daylight saving since 2022.

/** How many past days the shopper can pick for a payment (today and the 6 days before). */
export const PAYMENT_DAYS = 7;

/** A day picked by the shopper (0 = today, 1 = yesterday…) + hour and minute → the moment in Tehran time; null if in the future. */
export function paidAtFrom(daysAgo: number, hour: number, minute: number, now: Date): Date | null {
  const tehranNow = new Date(now.getTime() + TEHRAN_OFFSET_MS);
  const y = tehranNow.getUTCFullYear();
  const m = tehranNow.getUTCMonth();
  const d = tehranNow.getUTCDate() - daysAgo;
  const at = new Date(Date.UTC(y, m, d, hour, minute) - TEHRAN_OFFSET_MS);
  return at.getTime() > now.getTime() + 60_000 ? null : at;
}

/** The day list of the payment form: «امروز، چهارشنبه ۵ آذر», «دیروز، …», then the Persian date. */
export function paymentDayOptions(now: Date): { value: number; label: string }[] {
  return Array.from({ length: PAYMENT_DAYS }, (_, i) => {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toLocaleDateString("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return { value: i, label: i === 0 ? `امروز، ${day}` : i === 1 ? `دیروز، ${day}` : day };
  });
}

// ── Several payments (more than one card) ──

export type PaymentLine = { amountToman: number; verdict: "pending" | "confirmed" | "not_found" };

/** Confirmed and waiting amounts, and what is left to pay. Forms answered «پیدا نشد» do not count. */
export function paymentProgress(
  total: number,
  payments: readonly PaymentLine[],
): { confirmed: number; pending: number; remaining: number } {
  let confirmed = 0;
  let pending = 0;
  for (const p of payments) {
    if (p.verdict === "confirmed") confirmed += p.amountToman;
    else if (p.verdict === "pending") pending += p.amountToman;
  }
  return { confirmed, pending, remaining: Math.max(total - confirmed - pending, 0) };
}

/**
 * The order status after a payment form is sent or answered: paid when the confirmed amount covers
 * the total; payment_sent while a form waits for staff; otherwise back to awaiting payment.
 */
export function statusAfterPayments(total: number, payments: readonly PaymentLine[]): "paid" | "payment_sent" | "accepted" {
  const { confirmed, pending } = paymentProgress(total, payments);
  if (confirmed >= total) return "paid";
  return pending > 0 ? "payment_sent" : "accepted";
}

/** The gateway amount: the total plus tax and VAT (percent set by the manager), whole Toman. */
export function gatewayAmount(total: number, taxPercent: number): number {
  return Math.round((total * (100 + taxPercent)) / 100);
}

const digitsText = (min: number, max: number, message: string) =>
  z
    .string()
    .transform((s) => toAscii(s).replace(/[\s-]/g, ""))
    .pipe(z.string().regex(new RegExp(`^\\d{${min},${max}}$`), message));

export const paymentFormSchema = z.object({
  requestId: z.uuid(),
  // The payee card shown to the shopper; the server refuses if staff changed it meanwhile.
  payeeCard: z.string().regex(/^\d{16}$/, "کارت مقصد عوض شده است. صفحه را دوباره باز کنید."),
  tracking: digitsText(4, 30, "شماره پیگیری را درست بنویسید (فقط عدد)"),
  cardLast4: digitsText(4, 4, "۴ رقم آخر کارت خودتان را بنویسید"),
  paidDay: z.coerce.number({ error: "روز پرداخت را انتخاب کنید" }).int().min(0).max(PAYMENT_DAYS - 1, "روز پرداخت را انتخاب کنید"),
  paidHour: z.coerce.number({ error: "ساعت پرداخت را انتخاب کنید" }).int().min(0).max(23, "ساعت پرداخت را انتخاب کنید"),
  paidMinute: z.coerce.number({ error: "دقیقه‌ی پرداخت را انتخاب کنید" }).int().min(0).max(59, "دقیقه‌ی پرداخت را انتخاب کنید"),
  // Only with «بیشتر از یک کارت»: this payment's amount. Empty = the whole remaining amount.
  amount: optionalWhole("مبلغ این پرداخت را به تومان بنویسید", 1, 1_000_000_000_000),
  // The receipt photo saved when it was chosen (its file name), or empty.
  receiptFile: z
    .string()
    .default("")
    .refine((s) => s === "" || isSafePhotoName(s), "عکس رسید پیدا نشد. دوباره انتخابش کنید.")
    .transform((s) => s || null),
});

/** Receipts may be bigger than product photos (phone camera pictures). */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** Staff choose the payee: one of the warehouses' cards, or another card typed by hand. */
export const payeeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("warehouse"), requestId: z.uuid(), warehouseId: z.uuid({ error: "یک انبار انتخاب کنید" }) }),
  z.object({ mode: z.literal("other"), requestId: z.uuid(), cardNumber: cardNumberSchema, cardHolder: cardHolderSchema }),
]);

/** Staff answer one payment form: confirm it, or «پیدا نشد» with a reason. */
export const paymentVerdictSchema = z.object({
  requestId: z.uuid(),
  paymentId: z.uuid(),
  reason: z.string().trim().max(500, "دلیل خیلی بلند است").default(""),
});

export const reasonSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().trim().min(1, "دلیل را بنویسید").max(500, "دلیل خیلی بلند است"),
});

export const refundSchema = z.object({
  requestId: z.uuid(),
  reason: z.string().trim().min(1, "دلیل را بنویسید").max(500, "دلیل خیلی بلند است"),
});

/** The shopper's delivery method, asked once before «پرداخت با». */
export const deliverySchema = z.object({
  requestId: z.uuid(),
  deliveryMethod: z.enum(["tipax", "post", "courier", "pickup"], { error: "روش ارسال را انتخاب کنید" }),
});

/** Staff: the parcel tracking code, saved while typed. */
export const shippingCodeSchema = z.object({
  requestId: z.uuid(),
  code: z.string().trim().max(40, "کد رهگیری خیلی بلند است").default(""),
});

/** Staff: one money transfer back to the shopper, with an optional receipt photo. */
export const addRefundSchema = z.object({
  requestId: z.uuid(),
  amount: optionalWhole("مبلغ برگشتی را به تومان بنویسید", 1, 1_000_000_000_000).pipe(z.number({ error: "مبلغ برگشتی را بنویسید" })),
  tracking: digitsText(4, 30, "شماره پیگیری برگشت پول را بنویسید (فقط عدد)"),
  receiptFile: z
    .string()
    .default("")
    .refine((s) => s === "" || isSafePhotoName(s), "عکس رسید پیدا نشد. دوباره انتخابش کنید.")
    .transform((s) => s || null),
});

/** How much can still be sent back: confirmed payments minus what was already returned. */
export function refundable(confirmed: number, refunds: readonly { amountToman: number }[]): number {
  return Math.max(confirmed - refunds.reduce((sum, x) => sum + x.amountToman, 0), 0);
}

/**
 * Live check of the shopper's typed amount (several cards). null = fine; empty is fine too (the
 * server asks for it). The same limit the server checks inside the lock.
 */
export function amountProblem(amount: number | null, remaining: number): string | null {
  if (amount === null) return null;
  if (amount <= 0) return "مبلغ باید بیشتر از صفر باشد";
  if (amount > remaining) return "مبلغ بیشتر از باقی‌مانده‌ی فاکتور است";
  return null;
}

export const shipSchema = z.object({
  requestId: z.uuid(),
  code: z.string().trim().max(40, "کد رهگیری خیلی بلند است").default(""),
});

/** «ارسال شد» needs a tracking code for Tipax and post. */
export function canShip(method: DeliveryMethod | null, code: string): SubmitCheck {
  if (needsTrackingCode(method) && code.trim() === "") return { ok: false, error: "کد رهگیری مرسوله را بنویسید" };
  return { ok: true };
}
