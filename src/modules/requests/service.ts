import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, desc, eq, gt, inArray, lte, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db/client";
import { env } from "@/env";
import { detectImageType, isSafePhotoName, PHOTO_CONTENT_TYPES } from "@/lib/image";
import { groupFa } from "@/lib/money";
import { getCartProducts, getProductForStaff, getPurchasePrices, type CartProduct } from "@/modules/catalog";
import { getCurrentCustomer, getCustomersByIds, saveLastAddress } from "@/modules/customers";
import { canSee, getCurrentStaff, getStaffNames, noteStaffAction, type CurrentStaff } from "@/modules/staff";
import { listWarehouses } from "@/modules/warehouses";
import {
  beforePayment,
  canCancelOrder,
  canShip,
  defaultPayee,
  paidAtFrom,
  paymentProgress,
  refundable,
  statusAfterPayments,
  MAX_RECEIPT_BYTES,
  type DeliveryMethod,
  historyNote,
  type HistoryKind,
  hideStaffOnly,
  type StaffTab,
  canConfirm,
  canDo,
  canSubmit,
  cartTotal,
  clampQuantity,
  deadlineFrom,
  effectiveStatus,
  invoiceTotals,
  type DiscountKind,
  type Action,
  type CartLine,
  type Status,
} from "./rules";
import {
  requestsCartLines,
  requestsCarts,
  requestsHistory,
  requestsMessages,
  requestsPayments,
  requestsRefunds,
  requestsRequests,
  requestsRows,
} from "./schema";

// Server-side use cases of the requests module. Only this module touches the requests_* tables.
// Shoppers never get the warehouse or purchase price; staff pages get the warehouse name per row.

const CART_COOKIE = "anb_cart";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

// ── Cart ───────────────────────────────────────────────────────────────────────────────

async function cartByToken(): Promise<{ id: string; customerId: string | null } | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: requestsCarts.id, customerId: requestsCarts.customerId })
    .from(requestsCarts)
    .where(eq(requestsCarts.tokenHash, sha256(token)));
  return row ?? null;
}

/** Moves the lines and note of a browser cart into the shopper's cart (quantities capped). */
async function mergeCarts(fromId: string, intoId: string) {
  await db.transaction(async (tx) => {
    const [from] = await tx.select({ note: requestsCarts.note }).from(requestsCarts).where(eq(requestsCarts.id, fromId));
    const lines = await tx.select().from(requestsCartLines).where(eq(requestsCartLines.cartId, fromId));
    const products = new Map((await getCartProducts(lines.map((l) => l.productId))).map((p) => [p.id, p]));
    for (const l of lines) {
      const unit = products.get(l.productId)?.unit ?? "piece";
      await tx
        .insert(requestsCartLines)
        .values({ cartId: intoId, productId: l.productId, quantity: clampQuantity(l.quantity, unit) })
        .onConflictDoUpdate({
          target: [requestsCartLines.cartId, requestsCartLines.productId],
          set: { quantity: sql`least(${requestsCartLines.quantity} + ${l.quantity}, ${unit === "pair" ? 2 : 4})` },
        });
    }
    if (from?.note) {
      await tx
        .update(requestsCarts)
        .set({ note: sql`trim(both from ${requestsCarts.note} || E'\n' || ${from.note})`, updatedAt: new Date() })
        .where(eq(requestsCarts.id, intoId));
    }
    await tx.delete(requestsCarts).where(eq(requestsCarts.id, fromId));
  });
}

/**
 * The current cart's id, or null. A signed-in shopper uses their own cart; a cart started before
 * signing in is joined into it here, so "the cart is kept" across sign-in and sign-up.
 */
const currentCartId = cache(async (): Promise<string | null> => {
  await connection(); // reads the clock: request time only
  const [customer, browserCart] = await Promise.all([getCurrentCustomer(), cartByToken()]);
  if (!customer) return browserCart && !browserCart.customerId ? browserCart.id : null;

  const [own] = await db
    .select({ id: requestsCarts.id })
    .from(requestsCarts)
    .where(eq(requestsCarts.customerId, customer.id));
  if (browserCart && !browserCart.customerId) {
    if (!own) {
      await db.update(requestsCarts).set({ customerId: customer.id }).where(eq(requestsCarts.id, browserCart.id));
      return browserCart.id;
    }
    await mergeCarts(browserCart.id, own.id);
  }
  return own?.id ?? null;
});

/** For server actions: the current cart, created (with its cookie) when missing. */
async function ensureCart(): Promise<string> {
  const id = await currentCartId();
  if (id) return id;
  const customer = await getCurrentCustomer();
  if (customer) {
    const [row] = await db
      .insert(requestsCarts)
      .values({ customerId: customer.id })
      .onConflictDoUpdate({ target: requestsCarts.customerId, set: { updatedAt: new Date() } })
      .returning({ id: requestsCarts.id });
    return row.id;
  }
  const token = randomBytes(32).toString("base64url");
  const [row] = await db.insert(requestsCarts).values({ tokenHash: sha256(token) }).returning({ id: requestsCarts.id });
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return row.id;
}

export type CartViewLine = CartLine & { code: string; name: string };
export type CartView = { lines: CartViewLine[]; note: string; total: number; hasUnpriced: boolean };

/** The cart with today's prices and flags. */
export async function getCartView(): Promise<CartView> {
  const id = await currentCartId();
  if (!id) return { lines: [], note: "", total: 0, hasUnpriced: false };
  const [cart] = await db.select({ note: requestsCarts.note }).from(requestsCarts).where(eq(requestsCarts.id, id));
  const rows = await db
    .select({ productId: requestsCartLines.productId, quantity: requestsCartLines.quantity })
    .from(requestsCartLines)
    .where(eq(requestsCartLines.cartId, id))
    .orderBy(asc(requestsCartLines.addedAt));
  const products = new Map((await getCartProducts(rows.map((r) => r.productId))).map((p) => [p.id, p]));
  const lines: CartViewLine[] = rows.flatMap((r) => {
    const p = products.get(r.productId);
    if (!p) return [];
    return [
      {
        productId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        quantity: r.quantity,
        shopPriceToman: p.shopPriceToman,
        isActive: p.isActive,
        isUnavailable: p.isUnavailable,
      },
    ];
  });
  return { lines, note: cart?.note ?? "", ...cartTotal(lines) };
}

export async function cartItemCount(): Promise<number> {
  const id = await currentCartId();
  if (!id) return 0;
  const [{ n }] = await db.select({ n: count() }).from(requestsCartLines).where(eq(requestsCartLines.cartId, id));
  return n;
}

export async function addToCart(productId: string, quantity: number): Promise<Result> {
  const [p] = await getCartProducts([productId]);
  if (!p || !p.isActive) return { ok: false, error: "این کالا پیدا نشد" };
  if (p.isUnavailable) return { ok: false, error: "این کالا ناموجود است" };
  const cartId = await ensureCart();
  const q = clampQuantity(quantity, p.unit);
  await db
    .insert(requestsCartLines)
    .values({ cartId, productId, quantity: q })
    .onConflictDoUpdate({ target: [requestsCartLines.cartId, requestsCartLines.productId], set: { quantity: q } });
  await db.update(requestsCarts).set({ updatedAt: new Date() }).where(eq(requestsCarts.id, cartId));
  return { ok: true };
}

export async function setCartQuantity(productId: string, quantity: number) {
  const cartId = await currentCartId();
  if (!cartId) return;
  const [p] = await getCartProducts([productId]);
  await db
    .update(requestsCartLines)
    .set({ quantity: clampQuantity(quantity, p?.unit ?? "piece") })
    .where(and(eq(requestsCartLines.cartId, cartId), eq(requestsCartLines.productId, productId)));
}

export async function removeFromCart(productId: string) {
  const cartId = await currentCartId();
  if (!cartId) return;
  await db
    .delete(requestsCartLines)
    .where(and(eq(requestsCartLines.cartId, cartId), eq(requestsCartLines.productId, productId)));
}

export async function setCartNote(note: string) {
  const cartId = note ? await ensureCart() : await currentCartId();
  if (!cartId) return;
  await db.update(requestsCarts).set({ note, updatedAt: new Date() }).where(eq(requestsCarts.id, cartId));
}

// ── Submitting a request ───────────────────────────────────────────────────────────────

/** The shopper sends the cart: today's prices are copied into the request, the cart is emptied. */
export async function submitRequest(customerId: string, address: string): Promise<Result<{ id: string }>> {
  const cartId = await currentCartId();
  const view = await getCartView();
  const check = canSubmit(view.lines, view.note);
  if (!cartId || !check.ok) return { ok: false, error: check.ok ? "سبد خالی است" : check.error };
  const products = new Map((await getCartProducts(view.lines.map((l) => l.productId))).map((p) => [p.id, p]));
  const purchase = await getPurchasePrices(view.lines.map((l) => l.productId));

  const id = await db.transaction(async (tx) => {
    const now = new Date();
    const [req] = await tx
      .insert(requestsRequests)
      .values({ customerId, address, note: view.note, createdAt: now, updatedAt: now })
      .returning({ id: requestsRequests.id });
    if (view.lines.length > 0) {
      await tx.insert(requestsRows).values(
        view.lines.map((l, i) => ({
          requestId: req.id,
          productId: l.productId,
          code: l.code,
          name: l.name,
          unit: l.unit,
          warehouseId: products.get(l.productId)?.warehouseId ?? null,
          quantity: l.quantity,
          priceToman: l.shopPriceToman,
          purchasePriceToman: purchase.get(l.productId) ?? null,
          position: i,
        })),
      );
    }
    await tx.delete(requestsCartLines).where(eq(requestsCartLines.cartId, cartId));
    await tx.update(requestsCarts).set({ note: "", updatedAt: now }).where(eq(requestsCarts.id, cartId));
    return req.id;
  });
  await saveLastAddress(customerId, address);
  return { ok: true, id };
}

// ── Reading requests ───────────────────────────────────────────────────────────────────

export type RequestSummary = {
  id: string;
  number: number;
  status: Status;
  createdAt: Date;
  total: number;
  hasUnpriced: boolean;
  rowCount: number;
  /** The shopper wrote a note (توضیحات) with the request. */
  hasNote: boolean;
  needsAttention: boolean;
  /** When staff first opened it since the shopper's last step; null = not opened. */
  staffSeenAt: Date | null;
};

async function summaries(
  where: SQL | undefined,
  forStaff: boolean,
): Promise<(RequestSummary & { customerId: string })[]> {
  await connection(); // reads the clock: request time only
  const reqs = await db
    .select()
    .from(requestsRequests)
    .where(where)
    .orderBy(desc(requestsRequests.createdAt))
    .limit(200);
  if (reqs.length === 0) return [];
  const rows = await db
    .select({
      requestId: requestsRows.requestId,
      quantity: requestsRows.quantity,
      priceToman: requestsRows.priceToman,
      isUnavailable: requestsRows.isUnavailable,
      discountPercent: requestsRows.discountPercent,
    })
    .from(requestsRows)
    .where(inArray(requestsRows.requestId, reqs.map((r) => r.id)));
  const now = new Date();
  return reqs.map((r) => {
    const mine = rows.filter((x) => x.requestId === r.id);
    return {
      id: r.id,
      number: r.number,
      customerId: r.customerId,
      status: effectiveStatus(r, now),
      createdAt: r.createdAt,
      rowCount: mine.length,
      hasNote: r.note.trim() !== "",
      staffSeenAt: forStaff ? r.staffSeenAt : null,
      needsAttention: forStaff
        ? r.staffSeenAt === null || r.staffUnreadMessageAt !== null
        : !!r.customerNotifyAt && (!r.customerSeenAt || r.customerSeenAt < r.customerNotifyAt),
      ...invoiceTotals(mine, { kind: r.discountKind, value: r.discountValue }),
    };
  });
}

export async function listMyRequests(customerId: string) {
  return summaries(eq(requestsRequests.customerId, customerId), false);
}

/** Header marker: requests with a staff answer the shopper has not opened yet. */
export async function myUnseenCount(customerId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(requestsRequests)
    .where(
      and(
        eq(requestsRequests.customerId, customerId),
        sql`${requestsRequests.customerNotifyAt} is not null`,
        or(
          isNull(requestsRequests.customerSeenAt),
          sql`${requestsRequests.customerSeenAt} < ${requestsRequests.customerNotifyAt}`,
        ),
      ),
    );
  return n;
}

export type RequestDetails = {
  id: string;
  number: number;
  customerId: string;
  status: Status;
  address: string;
  note: string;
  rejectReason: string;
  deadlineAt: Date | null;
  createdAt: Date;
  rows: (typeof requestsRows.$inferSelect)[];
  messages: { id: string; body: string; fromShopper: boolean; createdAt: Date }[];
  subtotal: number;
  discount: number;
  discountKind: DiscountKind;
  discountValue: number;
  total: number;
  hasUnpriced: boolean;
  // Payment and order (#19)
  payeeCard: string | null;
  payeeName: string | null;
  paymentFormAt: Date | null;
  deliveryMethod: DeliveryMethod | null;
  shippingCode: string;
  refundReason: string;
  refundTracking: string;
  /** Payment forms, newest first. */
  payments: PaymentView[];
  /** Money sent back to the shopper, oldest first. */
  refunds: RefundView[];
};

export type PaymentView = Omit<typeof requestsPayments.$inferSelect, "requestId">;
export type RefundView = Omit<typeof requestsRefunds.$inferSelect, "requestId">;

async function loadRequest(where: SQL): Promise<RequestDetails | null> {
  await connection(); // reads the clock: request time only
  const [r] = await db.select().from(requestsRequests).where(where);
  if (!r) return null;
  const [rows, messages, payments, refunds] = await Promise.all([
    db.select().from(requestsRows).where(eq(requestsRows.requestId, r.id)).orderBy(asc(requestsRows.position)),
    db
      .select({
        id: requestsMessages.id,
        body: requestsMessages.body,
        fromShopper: requestsMessages.fromShopper,
        createdAt: requestsMessages.createdAt,
      })
      .from(requestsMessages)
      .where(eq(requestsMessages.requestId, r.id))
      .orderBy(asc(requestsMessages.createdAt)),
    db.select().from(requestsPayments).where(eq(requestsPayments.requestId, r.id)).orderBy(desc(requestsPayments.createdAt)),
    db.select().from(requestsRefunds).where(eq(requestsRefunds.requestId, r.id)).orderBy(asc(requestsRefunds.createdAt)),
  ]);
  return {
    id: r.id,
    number: r.number,
    customerId: r.customerId,
    status: effectiveStatus(r, new Date()),
    address: r.address,
    note: r.note,
    rejectReason: r.rejectReason,
    deadlineAt: r.deadlineAt,
    createdAt: r.createdAt,
    rows,
    messages,
    discountKind: r.discountKind,
    discountValue: r.discountValue,
    ...invoiceTotals(rows, { kind: r.discountKind, value: r.discountValue }),
    payeeCard: r.payeeCard,
    payeeName: r.payeeName,
    paymentFormAt: r.paymentFormAt,
    deliveryMethod: r.deliveryMethod,
    shippingCode: r.shippingCode,
    refundReason: r.refundReason,
    refundTracking: r.refundTracking,
    payments: payments.map((p) => ({ ...p, requestId: undefined })),
    refunds: refunds.map((x) => ({ ...x, requestId: undefined })),
  };
}

/** The shopper's own request, or null for someone else's (the page shows "not found"). */
export async function getMyRequest(customerId: string, id: string) {
  const r = await loadRequest(and(eq(requestsRequests.id, id), eq(requestsRequests.customerId, customerId))!);
  if (!r) return r;
  await db.update(requestsRequests).set({ customerSeenAt: new Date() }).where(eq(requestsRequests.id, id));
  // Purchase prices are staff-only: they never reach a shopper's page.
  return {
    ...r,
    rows: hideStaffOnly(r.rows),
    payments: r.payments.map((p) => ({ ...p, receiptFile: p.receiptFile ? "sent" : null, decidedBy: null })),
    // Refund receipts are for the shopper to see (served by readRefundReceipt); who sent them is not.
    refunds: r.refunds.map((x) => ({ ...x, createdBy: "" })),
  };
}

// ── Status changes ─────────────────────────────────────────────────────────────────────

const NOT_ALLOWED = "این کار در وضعیت فعلی درخواست ممکن نیست. صفحه را دوباره باز کنید.";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CHANGED = "فاکتور تغییر کرده است. صفحه را دوباره باز کنید.";

/**
 * A status change: locks the request row, checks the status rule (and `check`, inside the same
 * transaction), then writes. Two people pressing buttons at once cannot both pass the check.
 */
async function move(
  id: string,
  action: Action,
  owner: string | null,
  set: Partial<typeof requestsRequests.$inferInsert>,
  opts: {
    check?: (tx: Tx, r: typeof requestsRequests.$inferSelect) => Promise<Result>;
    /** More writes in the same transaction, after the status change. */
    also?: (tx: Tx, r: typeof requestsRequests.$inferSelect) => Promise<void>;
    deadlineSeen?: Date;
    by?: { staffId: string; kind: HistoryKind };
  } = {},
): Promise<Result> {
  const where = owner ? and(eq(requestsRequests.id, id), eq(requestsRequests.customerId, owner)) : eq(requestsRequests.id, id);
  let number = 0;
  const res = await db.transaction(async (tx): Promise<Result> => {
    const [r] = await tx.select().from(requestsRequests).where(where).for("update");
    if (!r) return { ok: false, error: "درخواست پیدا نشد" };
    if (!canDo(action, effectiveStatus(r, new Date()))) return { ok: false, error: NOT_ALLOWED };
    // The shopper answers the invoice they saw: a re-confirmed invoice has a new deadline.
    if (opts.deadlineSeen && r.deadlineAt?.getTime() !== opts.deadlineSeen.getTime()) return { ok: false, error: CHANGED };
    if (opts.check) {
      const checked = await opts.check(tx, r);
      if (!checked.ok) return checked;
    }
    await tx
      .update(requestsRequests)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(requestsRequests.id, id));
    if (opts.also) await opts.also(tx, r);
    if (opts.by) await recordHistory(tx, id, opts.by.staffId, opts.by.kind);
    number = r.number;
    return { ok: true };
  });
  if (res.ok && opts.by) await noteStaffAction(opts.by.staffId, historyNote(opts.by.kind, number));
  return res;
}

/** A «تاریخچه» line. Edits by one person on one request stay one line whose time moves forward. */
async function recordHistory(tx: Tx, requestId: string, staffId: string, kind: HistoryKind) {
  const q = tx.insert(requestsHistory).values({ requestId, staffId, kind });
  if (kind === "edit") {
    await q.onConflictDoUpdate({
      target: [requestsHistory.requestId, requestsHistory.staffId],
      targetWhere: sql`${requestsHistory.kind} = 'edit'`,
      set: { at: sql`now()` },
    });
  } else {
    await q;
  }
}

// Shopper actions: staff are alerted again (staffSeenAt cleared).
export const cancelRequest = (customerId: string, id: string) =>
  move(id, "cancel", customerId, { status: "cancelled", staffSeenAt: null });

export const acceptRequest = (customerId: string, id: string, deadlineSeen: Date) =>
  move(id, "accept", customerId, { status: "accepted", staffSeenAt: null }, { deadlineSeen });

export const declineRequest = (customerId: string, id: string, deadlineSeen: Date) =>
  move(id, "decline", customerId, { status: "declined", staffSeenAt: null }, { deadlineSeen });

// ── Staff ──────────────────────────────────────────────────────────────────────────────

/** All requests for the staff list; the page splits them into tabs (`staffTabOf`). */
/** The SQL for one staff tab; the same rule as `staffTabOf` in rules.ts. */
function tabWhere(tab: StaffTab, now: Date): SQL | undefined {
  const s = requestsRequests.status;
  const deadline = requestsRequests.deadlineAt;
  const formAt = requestsRequests.paymentFormAt;
  const late = and(isNotNull(deadline), lte(deadline, now));
  // Same as rules.effectiveStatus: unanswered confirmed, or accepted with no payment form, past the deadline.
  const expired = or(and(eq(s, "confirmed"), late), and(eq(s, "accepted"), isNull(formAt), late));
  const onTime = or(isNull(deadline), gt(deadline, now));
  switch (tab) {
    case "new":
      return and(eq(s, "awaiting"), isNull(requestsRequests.staffSeenAt));
    case "working":
      return or(
        and(eq(s, "awaiting"), isNotNull(requestsRequests.staffSeenAt)),
        and(eq(s, "confirmed"), onTime),
        and(eq(s, "accepted"), or(isNotNull(formAt), onTime)),
        eq(s, "payment_sent"),
      );
    case "paid":
      return inArray(s, ["paid", "collecting", "shipped"]);
    case "void":
      return or(inArray(s, ["rejected", "cancelled", "declined", "refunded"]), expired);
    case "all":
      return undefined;
  }
}

/** Per tab: how many requests, and how many need staff attention (new step or unread message). */
export async function staffTabCounts(): Promise<Record<StaffTab, { n: number; attention: number }>> {
  await connection();
  const now = new Date();
  const tabs: StaffTab[] = ["new", "working", "paid", "void", "all"];
  const rows = await Promise.all(
    tabs.map((t) =>
      db
        .select({
          n: count(),
          attention: sql<number>`count(*) filter (where ${requestsRequests.staffSeenAt} is null or ${requestsRequests.staffUnreadMessageAt} is not null)`.mapWith(Number),
        })
        .from(requestsRequests)
        .where(tabWhere(t, now)),
    ),
  );
  return Object.fromEntries(tabs.map((t, i) => [t, rows[i][0] ?? { n: 0, attention: 0 }])) as Record<
    StaffTab,
    { n: number; attention: number }
  >;
}

/** One tab of the staff list (newest 200). */
export async function listRequestsForStaff(tab: StaffTab) {
  await connection();
  const list = await summaries(tabWhere(tab, new Date()), true);
  const [people, last] = await Promise.all([getCustomersByIds(list.map((r) => r.customerId)), lastHandlers(list.map((r) => r.id))]);
  // New or changed first, then newest.
  return list
    .map((r) => ({
      ...r,
      customerName: people.get(r.customerId)?.fullName ?? "",
      mobile: people.get(r.customerId)?.mobile ?? "",
      lastHandledBy: last.get(r.id) ?? null,
    }))
    .sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention));
}

/** «درخواست‌ها (n)»: requests staff have not opened since the shopper's last step or message. */
export async function staffAttentionCount(): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(requestsRequests)
    .where(or(isNull(requestsRequests.staffSeenAt), isNotNull(requestsRequests.staffUnreadMessageAt)));
  return n;
}

/**
 * For the admin alert sounds: requests with a new shopper step (new, cancelled, accepted…)
 * and requests with an unread shopper message. Each has its own sound.
 */
export async function staffAlertCounts(): Promise<{ steps: number; messages: number }> {
  const [row] = await db
    .select({
      steps: sql<number>`count(*) filter (where ${requestsRequests.staffSeenAt} is null)`.mapWith(Number),
      messages: sql<number>`count(*) filter (where ${requestsRequests.staffUnreadMessageAt} is not null)`.mapWith(Number),
    })
    .from(requestsRequests);
  return row ?? { steps: 0, messages: 0 };
}

/** «آخرین رسیدگی»: the name on the newest history line of each request. */
async function lastHandlers(requestIds: readonly string[]): Promise<Map<string, string>> {
  if (requestIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([requestsHistory.requestId], { requestId: requestsHistory.requestId, staffId: requestsHistory.staffId })
    .from(requestsHistory)
    .where(inArray(requestsHistory.requestId, [...requestIds]))
    .orderBy(requestsHistory.requestId, desc(requestsHistory.at));
  const names = await getStaffNames(rows.map((r) => r.staffId));
  return new Map(rows.map((r) => [r.requestId, names.get(r.staffId) ?? ""]));
}

/** «تاریخچه» under the invoice, newest first. */
async function historyOf(requestId: string) {
  const rows = await db
    .select({ staffId: requestsHistory.staffId, kind: requestsHistory.kind, at: requestsHistory.at })
    .from(requestsHistory)
    .where(eq(requestsHistory.requestId, requestId))
    .orderBy(desc(requestsHistory.at));
  const names = await getStaffNames(rows.map((r) => r.staffId));
  return rows.map((r) => ({ kind: r.kind, at: r.at, name: names.get(r.staffId) ?? "" }));
}

/**
 * One request for staff. Purchase price and typed profit reach the page only when `viewer` may see
 * profit (profit is worked out from the purchase price; the price itself is shown nowhere here).
 */
export async function getRequestForStaff(id: string, viewer: CurrentStaff) {
  const loaded = await loadRequest(eq(requestsRequests.id, id));
  if (!loaded) return null;
  const r = canSee(viewer, "profit") ? loaded : { ...loaded, rows: hideStaffOnly(loaded.rows) };
  await db
    .update(requestsRequests)
    .set({ staffSeenAt: sql`coalesce(${requestsRequests.staffSeenAt}, now())`, staffUnreadMessageAt: null })
    .where(
      and(
        eq(requestsRequests.id, id),
        or(isNull(requestsRequests.staffSeenAt), isNotNull(requestsRequests.staffUnreadMessageAt)),
      ),
    );
  const [people, warehouses, history, deciders] = await Promise.all([
    getCustomersByIds([r.customerId]),
    listWarehouses(),
    historyOf(id),
    getStaffNames([...r.payments.flatMap((p) => (p.decidedBy ? [p.decidedBy] : [])), ...r.refunds.map((x) => x.createdBy)]),
  ]);
  const names = new Map(warehouses.map((w) => [w.id, w.name]));
  return {
    ...r,
    history,
    payments: r.payments.map((p) => ({ ...p, decidedByName: p.decidedBy ? (deciders.get(p.decidedBy) ?? "") : "" })),
    refunds: r.refunds.map((x) => ({ ...x, createdByName: deciders.get(x.createdBy) ?? "" })),
    // Payee choices: every warehouse card.
    warehouseCards: warehouses.map((w) => ({ id: w.id, name: w.name, cardNumber: w.cardNumber, cardHolder: w.cardHolder })),
    customer: people.get(r.customerId) ?? null,
    warehouseNames: Object.fromEntries(r.rows.flatMap((x) => (x.warehouseId ? [[x.warehouseId, names.get(x.warehouseId) ?? ""]] : []))),
  };
}

async function requireStatus(requestId: string, action: Action): Promise<Result> {
  const [r] = await db.select().from(requestsRequests).where(eq(requestsRequests.id, requestId));
  if (!r) return { ok: false, error: "درخواست پیدا نشد" };
  return canDo(action, effectiveStatus(r, new Date())) ? { ok: true } : { ok: false, error: NOT_ALLOWED };
}

/** Runs a staff edit while the request row is locked and still editable, so a confirm cannot slip in between. */
async function whileEditable(staffId: string, requestId: string, write: (tx: Tx) => Promise<void>): Promise<Result> {
  let number = 0;
  const res = await db.transaction(async (tx): Promise<Result> => {
    const [r] = await tx.select().from(requestsRequests).where(eq(requestsRequests.id, requestId)).for("update");
    if (!r) return { ok: false, error: "درخواست پیدا نشد" };
    if (!canDo("staffEdit", effectiveStatus(r, new Date()))) return { ok: false, error: NOT_ALLOWED };
    await write(tx);
    await recordHistory(tx, requestId, staffId, "edit");
    number = r.number;
    return { ok: true };
  });
  if (res.ok) await noteStaffAction(staffId, historyNote("edit", number));
  return res;
}

export async function editRow(
  staffId: string,
  rowId: string,
  v: {
    priceToman: number | null;
    quantity: number;
    isUnavailable: boolean;
    discountPercent: number;
    manualProfitToman?: number | null;
  },
): Promise<Result> {
  const [row] = await db
    .select({ requestId: requestsRows.requestId, purchasePriceToman: requestsRows.purchasePriceToman })
    .from(requestsRows)
    .where(eq(requestsRows.id, rowId));
  if (!row) return { ok: false, error: "ردیف پیدا نشد" };
  // Only a row with no purchase price takes a typed profit.
  const set = row.purchasePriceToman === null || v.manualProfitToman === undefined ? v : { ...v, manualProfitToman: null };
  return whileEditable(staffId, row.requestId, async (tx) => {
    await tx.update(requestsRows).set(set).where(eq(requestsRows.id, rowId));
  });
}

/** The «تخفیف» box beside the total: a discount on the whole invoice, while staff may edit rows. */
export async function setInvoiceDiscount(staffId: string, requestId: string, kind: DiscountKind, value: number): Promise<Result> {
  return whileEditable(staffId, requestId, async (tx) => {
    await tx
      .update(requestsRequests)
      .set({ discountKind: kind, discountValue: value })
      .where(eq(requestsRequests.id, requestId));
  });
}

export async function addRow(
  staffId: string,
  requestId: string,
  v: { code: string; name: string; priceToman: number | null; quantity: number | null; unit: "piece" | "pair" },
): Promise<Result> {
  let product: CartProduct | null = null;
  if (v.code) {
    product = await getProductForStaff(v.code);
    if (!product) return { ok: false, error: "کالایی با این کد فنی پیدا نشد" };
  }
  const purchasePriceToman = product ? ((await getPurchasePrices([product.id])).get(product.id) ?? null) : null;
  return whileEditable(staffId, requestId, async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(requestsRows).where(eq(requestsRows.requestId, requestId));
    await tx.insert(requestsRows).values({
      requestId,
      productId: product?.id ?? null,
      code: product?.code ?? null,
      name: v.name || product?.name || "",
      unit: product?.unit ?? v.unit,
      warehouseId: product?.warehouseId ?? null,
      quantity: v.quantity ?? 1,
      priceToman: v.priceToman ?? product?.shopPriceToman ?? null,
      purchasePriceToman,
      addedByStaff: true,
      position: n,
    });
  });
}

async function notifyCustomer(tx: Pick<typeof db, "update">, requestId: string) {
  await tx.update(requestsRequests).set({ customerNotifyAt: new Date() }).where(eq(requestsRequests.id, requestId));
}

export async function sendMessage(requestId: string, body: string): Promise<Result> {
  const allowed = await requireStatus(requestId, "message");
  if (!allowed.ok) return allowed;
  await db.transaction(async (tx) => {
    await tx.insert(requestsMessages).values({ requestId, body });
    await notifyCustomer(tx, requestId);
  });
  return { ok: true };
}

/** A shopper writes to staff on their own request. Staff hear the message sound. */
export async function sendShopperMessage(customerId: string, requestId: string, body: string): Promise<Result> {
  const [r] = await db
    .select()
    .from(requestsRequests)
    .where(and(eq(requestsRequests.id, requestId), eq(requestsRequests.customerId, customerId)));
  if (!r) return { ok: false, error: "درخواست پیدا نشد" };
  if (!canDo("shopperMessage", effectiveStatus(r, new Date()))) return { ok: false, error: NOT_ALLOWED };
  await db.transaction(async (tx) => {
    await tx.insert(requestsMessages).values({ requestId, body, fromShopper: true });
    await tx.update(requestsRequests).set({ staffUnreadMessageAt: new Date() }).where(eq(requestsRequests.id, requestId));
  });
  return { ok: true };
}

export async function confirmRequest(staffId: string, requestId: string, hours: number | null, message: string): Promise<Result> {
  const res = await move(requestId, "confirm", null, {
    status: "confirmed",
    deadlineAt: deadlineFrom(hours, new Date()),
    customerNotifyAt: new Date(),
  }, {
    check: async (tx) => canConfirm(await tx.select().from(requestsRows).where(eq(requestsRows.requestId, requestId))),
    by: { staffId, kind: "confirm" },
  });
  if (res.ok && message) await db.insert(requestsMessages).values({ requestId, body: message });
  if (res.ok) await suggestPayee(requestId);
  return res;
}

/**
 * The suggested payee card (largest warehouse share), worked out again at every confirm (the invoice
 * may have changed after «ویرایش فاکتور»), unless staff chose a card by hand for this request.
 */
async function suggestPayee(requestId: string) {
  const [chosen] = await db
    .select({ id: requestsHistory.id })
    .from(requestsHistory)
    .where(and(eq(requestsHistory.requestId, requestId), eq(requestsHistory.kind, "payee_card")))
    .limit(1);
  if (chosen) return;
  const [rows, warehouses] = await Promise.all([
    db.select().from(requestsRows).where(eq(requestsRows.requestId, requestId)),
    listWarehouses(),
  ]);
  const card = defaultPayee(rows, warehouses);
  if (!card) return;
  await db
    .update(requestsRequests)
    .set({ payeeCard: card.cardNumber, payeeName: card.cardHolder })
    .where(and(eq(requestsRequests.id, requestId), isNull(requestsRequests.paymentFormAt)));
}

export const REOPEN_MESSAGE = "فاکتور شما در حال ویرایش است. بعد از تأیید دوباره خبرتان می‌کنیم.";

/**
 * Staff «ویرایش فاکتور» after confirming (or after the shopper accepted): the request goes back to
 * awaiting, the old invoice can no longer be accepted, and staff confirm again with a new deadline.
 */
export async function reopenRequest(staffId: string, requestId: string): Promise<Result> {
  const res = await move(
    requestId,
    "reopen",
    null,
    { status: "awaiting", deadlineAt: null, customerNotifyAt: new Date() },
    { check: async (_tx, r) => (beforePayment(r) ? { ok: true } : { ok: false, error: AFTER_PAYMENT }), by: { staffId, kind: "reopen" } },
  );
  if (res.ok) await db.insert(requestsMessages).values({ requestId, body: REOPEN_MESSAGE });
  return res;
}

export async function rejectRequest(staffId: string, requestId: string, reason: string): Promise<Result> {
  return move(
    requestId,
    "reject",
    null,
    { status: "rejected", rejectReason: reason, customerNotifyAt: new Date() },
    { by: { staffId, kind: "reject" } },
  );
}
// ── Payment and order (card-to-card, #19) ──────────────────────────────────────────────

const AFTER_PAYMENT = "بعد از رسیدن فرم پرداخت این کار ممکن نیست.";

/** Staff choose the payee card: a warehouse's card or another one. Only until a payment form arrives. */
export async function setPayee(
  staffId: string,
  requestId: string,
  input: { mode: "warehouse"; warehouseId: string } | { mode: "other"; cardNumber: string; cardHolder: string },
): Promise<Result> {
  let card: { cardNumber: string; cardHolder: string };
  if (input.mode === "warehouse") {
    const w = (await listWarehouses()).find((x) => x.id === input.warehouseId);
    if (!w) return { ok: false, error: "انبار پیدا نشد" };
    card = { cardNumber: w.cardNumber, cardHolder: w.cardHolder };
  } else {
    card = { cardNumber: input.cardNumber, cardHolder: input.cardHolder };
  }
  return move(
    requestId,
    "setPayee",
    null,
    { payeeCard: card.cardNumber, payeeName: card.cardHolder },
    {
      check: async (_tx, r) => (beforePayment(r) ? { ok: true } : { ok: false, error: AFTER_PAYMENT }),
      by: { staffId, kind: "payee_card" },
    },
  );
}

/** UPLOAD_DIR/receipts: payment receipt photos. Private: served only to signed-in staff. */
function receiptsDir() {
  return path.resolve(/*turbopackIgnore: true*/ env.UPLOAD_DIR, "receipts");
}

/** Checks and saves a receipt photo. Returns its file name, or an error for the shopper. */
async function saveReceipt(file: File): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "حجم عکس رسید باید کمتر از ۱۰ مگابایت باشد" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, error: "عکس رسید باید jpg، png یا webp باشد" };
  const name = `${randomUUID()}.${type}`;
  await mkdir(receiptsDir(), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ receiptsDir(), name), bytes);
  return { ok: true, name };
}

/**
 * The receipt photo is saved as soon as the shopper picks it (so an error in the form never loses it).
 * Only for the shopper's own request that is waiting for payment. Returns the file name for the form.
 */
export async function uploadReceipt(
  customerId: string,
  requestId: string,
  file: File,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const [r] = await db
    .select()
    .from(requestsRequests)
    .where(and(eq(requestsRequests.id, requestId), eq(requestsRequests.customerId, customerId)));
  if (!r || !canDo("pay", effectiveStatus(r, new Date()))) return { ok: false, error: NOT_ALLOWED };
  return saveReceipt(file);
}

async function receiptExists(name: string): Promise<boolean> {
  try {
    await stat(path.join(/*turbopackIgnore: true*/ receiptsDir(), name));
    return true;
  } catch {
    return false;
  }
}

/**
 * The shopper's payment form after card-to-card. `amount` = this payment (several cards); null = all
 * that is left. It may not be more than what is left (total − confirmed − waiting forms).
 */
export async function sendPayment(
  customerId: string,
  requestId: string,
  form: {
    tracking: string;
    cardLast4: string;
    paidDay: number;
    paidHour: number;
    paidMinute: number;
    payeeCard: string;
    amount: number | null;
    receiptFile: string | null;
  },
): Promise<Result> {
  const paidAt = paidAtFrom(form.paidDay, form.paidHour, form.paidMinute, new Date());
  if (!paidAt) return { ok: false, error: "زمان پرداخت نمی‌تواند بعد از الان باشد" };
  if (form.receiptFile && !(await receiptExists(form.receiptFile))) {
    return { ok: false, error: "عکس رسید پیدا نشد. دوباره انتخابش کنید." };
  }
  return move(
    requestId,
    "pay",
    customerId,
    { status: "payment_sent", staffSeenAt: null },
    {
      check: async (tx, r) => {
        if (!r.deliveryMethod) return { ok: false, error: "اول روش ارسال را انتخاب کنید" };
        if (r.payeeCard !== form.payeeCard) return { ok: false, error: "کارت مقصد عوض شده است. صفحه را دوباره باز کنید." };
        if (!r.payeeCard || !r.payeeName) {
          return { ok: false, error: "کارت مقصد هنوز مشخص نشده است. با پشتیبانی تماس بگیرید." };
        }
        const { remaining } = await progressOf(tx, r);
        if (remaining <= 0) return { ok: false, error: "مبلغ این سفارش کامل فرستاده شده است." };
        if (form.amount !== null && form.amount > remaining) {
          return { ok: false, error: `مبلغ بیشتر از باقی‌مانده است (باقی‌مانده: ${groupFa(remaining)} تومان)` };
        }
        return { ok: true };
      },
      also: async (tx, r) => {
        // The first form stops the deadline; later forms keep the first time.
        if (!r.paymentFormAt) await tx.update(requestsRequests).set({ paymentFormAt: new Date() }).where(eq(requestsRequests.id, requestId));
        const { remaining } = await progressOf(tx, r);
        await tx.insert(requestsPayments).values({
          requestId,
          amountToman: form.amount ?? remaining,
          payeeCard: r.payeeCard ?? "",
          payeeName: r.payeeName ?? "",
          tracking: form.tracking,
          cardLast4: form.cardLast4,
          paidAt,
          deliveryMethod: r.deliveryMethod ?? "pickup", // always set: checked above
          receiptFile: form.receiptFile,
        });
      },
    },
  );
}

/** The invoice total and its payment forms, read inside the locked transaction. */
async function progressOf(tx: Tx, r: typeof requestsRequests.$inferSelect) {
  const [rows, payments] = await Promise.all([
    tx.select().from(requestsRows).where(eq(requestsRows.requestId, r.id)),
    tx
      .select({ amountToman: requestsPayments.amountToman, verdict: requestsPayments.verdict })
      .from(requestsPayments)
      .where(eq(requestsPayments.requestId, r.id)),
  ]);
  const { total } = invoiceTotals(rows, { kind: r.discountKind, value: r.discountValue });
  return { total, payments, ...paymentProgress(total, payments) };
}

/**
 * Staff answer one waiting payment form. The order then moves by what is confirmed: paid when the
 * confirmed amount covers the total, still «payment sent» while other forms wait, else awaiting payment.
 */
function decide(staffId: string, requestId: string, paymentId: string, verdict: "confirmed" | "not_found", reason = "") {
  return async (tx: Tx, r: typeof requestsRequests.$inferSelect) => {
    const updated = await tx
      .update(requestsPayments)
      .set({ verdict, verdictReason: reason, decidedBy: staffId, decidedAt: new Date() })
      .where(
        and(eq(requestsPayments.id, paymentId), eq(requestsPayments.requestId, requestId), eq(requestsPayments.verdict, "pending")),
      )
      .returning({ id: requestsPayments.id });
    if (updated.length === 0) throw new PaymentGone();
    const { total, payments } = await progressOf(tx, r);
    await tx
      .update(requestsRequests)
      .set({ status: statusAfterPayments(total, payments) })
      .where(eq(requestsRequests.id, requestId));
    if (verdict === "not_found") await tx.insert(requestsMessages).values({ requestId, body: `پرداخت پیدا نشد: ${reason}` });
  };
}

/** The form was already answered by someone else: the transaction rolls back. */
class PaymentGone extends Error {}

async function answerPayment(
  staffId: string,
  requestId: string,
  paymentId: string,
  verdict: "confirmed" | "not_found",
  reason: string,
): Promise<Result> {
  try {
    return await move(
      requestId,
      verdict === "confirmed" ? "confirmPayment" : "paymentNotFound",
      null,
      { customerNotifyAt: new Date() },
      {
        also: decide(staffId, requestId, paymentId, verdict, reason),
        by: { staffId, kind: verdict === "confirmed" ? "payment_confirmed" : "payment_not_found" },
      },
    );
  } catch (e) {
    if (e instanceof PaymentGone) return { ok: false, error: "این فرم پرداخت قبلاً بررسی شده است. صفحه را دوباره باز کنید." };
    throw e;
  }
}

export const confirmPayment = (staffId: string, requestId: string, paymentId: string) =>
  answerPayment(staffId, requestId, paymentId, "confirmed", "");

/** «پرداخت پیدا نشد» for one form: the shopper sees the reason and can send it again. */
export async function paymentNotFound(staffId: string, requestId: string, paymentId: string, reason: string): Promise<Result> {
  if (!reason.trim()) return { ok: false, error: "دلیل را بنویسید" };
  return answerPayment(staffId, requestId, paymentId, "not_found", reason);
}

export const markCollecting = (staffId: string, requestId: string) =>
  move(requestId, "collect", null, { status: "collecting", customerNotifyAt: new Date() }, { by: { staffId, kind: "collecting" } });

export const markShipped = (staffId: string, requestId: string, code: string) =>
  move(
    requestId,
    "ship",
    null,
    { status: "shipped", shippingCode: code.trim(), customerNotifyAt: new Date() },
    { check: async (_tx, r) => canShip(r.deliveryMethod, code), by: { staffId, kind: "shipped" } },
  );

/** «لغو و برگشت پول»: the order is cancelled; the money transfers back are recorded with `addRefund`. */
export const refundOrder = (staffId: string, requestId: string, reason: string) =>
  move(
    requestId,
    "refund",
    null,
    { status: "refunded", refundReason: reason, customerNotifyAt: new Date() },
    {
      check: async (_tx, r) =>
        canCancelOrder(r.status, r.paymentFormAt) ? { ok: true } : { ok: false, error: "این سفارش هنوز پرداختی ندارد." },
      by: { staffId, kind: "refunded" },
    },
  );

/** The shopper picks the delivery method once, before paying (and may change it until the payment is confirmed). */
export const setDelivery = (customerId: string, requestId: string, deliveryMethod: DeliveryMethod) =>
  move(requestId, "setDelivery", customerId, { deliveryMethod });

/** Staff type the parcel tracking code; it saves by itself, and the shopper sees it once shipped. */
export const saveShippingCode = (requestId: string, code: string) =>
  move(requestId, "shippingCode", null, { shippingCode: code.trim() });

/** Staff: a refund receipt photo is saved as soon as it is picked. */
export async function uploadRefundReceipt(file: File) {
  return saveReceipt(file);
}

/**
 * Staff record one money transfer back to the shopper. All transfers together may not be more than
 * the confirmed payments. The shopper is notified and sees the amount, tracking and receipt.
 */
export async function addRefund(
  staffId: string,
  requestId: string,
  input: { amount: number; tracking: string; receiptFile: string | null },
): Promise<Result> {
  if (input.receiptFile && !(await receiptExists(input.receiptFile))) {
    return { ok: false, error: "عکس رسید پیدا نشد. دوباره انتخابش کنید." };
  }
  return move(
    requestId,
    "addRefund",
    null,
    { customerNotifyAt: new Date() },
    {
      check: async (tx, r) => {
        const [payments, done] = await Promise.all([
          tx
            .select({ amountToman: requestsPayments.amountToman, verdict: requestsPayments.verdict })
            .from(requestsPayments)
            .where(eq(requestsPayments.requestId, r.id)),
          tx.select({ amountToman: requestsRefunds.amountToman }).from(requestsRefunds).where(eq(requestsRefunds.requestId, r.id)),
        ]);
        const confirmed = payments.reduce((sum, p) => sum + (p.verdict === "confirmed" ? p.amountToman : 0), 0);
        const left = refundable(confirmed, done);
        if (left <= 0) return { ok: false, error: "پول تأیید شده‌ای برای برگرداندن نمانده است" };
        if (input.amount > left) return { ok: false, error: `مبلغ بیشتر از پول قابل برگشت است (${groupFa(left)} تومان)` };
        return { ok: true };
      },
      also: async (tx) => {
        await tx.insert(requestsRefunds).values({
          requestId,
          amountToman: input.amount,
          tracking: input.tracking,
          receiptFile: input.receiptFile,
          createdBy: staffId,
        });
      },
      by: { staffId, kind: "refund_paid" },
    },
  );
}

/** A receipt photo for signed-in staff only; null for anyone else or a bad name. */
export async function readReceipt(name: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!(await getCurrentStaff()) || !isSafePhotoName(name)) return null;
  return readPhoto(name);
}

/**
 * A refund receipt photo: for signed-in staff, or for the shopper of the request it belongs to.
 * null for anyone else or a bad name.
 */
export async function readRefundReceipt(name: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!isSafePhotoName(name)) return null;
  if (!(await getCurrentStaff())) {
    const customer = await getCurrentCustomer();
    if (!customer) return null;
    const [own] = await db
      .select({ id: requestsRefunds.id })
      .from(requestsRefunds)
      .innerJoin(requestsRequests, eq(requestsRequests.id, requestsRefunds.requestId))
      .where(and(eq(requestsRefunds.receiptFile, name), eq(requestsRequests.customerId, customer.id)));
    if (!own) return null;
  }
  return readPhoto(name);
}

async function readPhoto(name: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const bytes = await readFile(path.join(/*turbopackIgnore: true*/ receiptsDir(), name));
    const ext = name.slice(name.lastIndexOf(".") + 1) as keyof typeof PHOTO_CONTENT_TYPES;
    return { bytes, contentType: PHOTO_CONTENT_TYPES[ext] };
  } catch {
    return null;
  }
}
