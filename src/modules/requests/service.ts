import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db/client";
import { getCartProducts, getProductForStaff, type CartProduct } from "@/modules/catalog";
import { getCurrentCustomer, getCustomersByIds, saveLastAddress } from "@/modules/customers";
import { listWarehouses } from "@/modules/warehouses";
import {
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
import { requestsCartLines, requestsCarts, requestsMessages, requestsRequests, requestsRows } from "./schema";

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
};

async function loadRequest(where: SQL): Promise<RequestDetails | null> {
  await connection(); // reads the clock: request time only
  const [r] = await db.select().from(requestsRequests).where(where);
  if (!r) return null;
  const [rows, messages] = await Promise.all([
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
  };
}

/** The shopper's own request, or null for someone else's (the page shows "not found"). */
export async function getMyRequest(customerId: string, id: string) {
  const r = await loadRequest(and(eq(requestsRequests.id, id), eq(requestsRequests.customerId, customerId))!);
  if (r) {
    await db.update(requestsRequests).set({ customerSeenAt: new Date() }).where(eq(requestsRequests.id, id));
  }
  return r;
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
  opts: { check?: (tx: Tx) => Promise<Result>; deadlineSeen?: Date } = {},
): Promise<Result> {
  const where = owner ? and(eq(requestsRequests.id, id), eq(requestsRequests.customerId, owner)) : eq(requestsRequests.id, id);
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(requestsRequests).where(where).for("update");
    if (!r) return { ok: false, error: "درخواست پیدا نشد" };
    if (!canDo(action, effectiveStatus(r, new Date()))) return { ok: false, error: NOT_ALLOWED };
    // The shopper answers the invoice they saw: a re-confirmed invoice has a new deadline.
    if (opts.deadlineSeen && r.deadlineAt?.getTime() !== opts.deadlineSeen.getTime()) return { ok: false, error: CHANGED };
    if (opts.check) {
      const checked = await opts.check(tx);
      if (!checked.ok) return checked;
    }
    await tx
      .update(requestsRequests)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(requestsRequests.id, id));
    return { ok: true };
  });
}

// Shopper actions: staff are alerted again (staffSeenAt cleared).
export const cancelRequest = (customerId: string, id: string) =>
  move(id, "cancel", customerId, { status: "cancelled", staffSeenAt: null });

export const acceptRequest = (customerId: string, id: string, deadlineSeen: Date) =>
  move(id, "accept", customerId, { status: "accepted", staffSeenAt: null }, { deadlineSeen });

export const declineRequest = (customerId: string, id: string, deadlineSeen: Date) =>
  move(id, "decline", customerId, { status: "declined", staffSeenAt: null }, { deadlineSeen });

// ── Staff ──────────────────────────────────────────────────────────────────────────────

export type StaffFilter = "open" | "all";

export async function listRequestsForStaff(filter: StaffFilter) {
  const where =
    filter === "open"
      ? or(
          isNull(requestsRequests.staffSeenAt),
          isNotNull(requestsRequests.staffUnreadMessageAt),
          inArray(requestsRequests.status, ["awaiting", "confirmed", "accepted"]),
        )
      : undefined;
  const list = await summaries(where, true);
  const people = await getCustomersByIds(list.map((r) => r.customerId));
  // New or changed first, then newest.
  return list
    .map((r) => ({ ...r, customerName: people.get(r.customerId)?.fullName ?? "", mobile: people.get(r.customerId)?.mobile ?? "" }))
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

export async function getRequestForStaff(id: string) {
  const r = await loadRequest(eq(requestsRequests.id, id));
  if (!r) return null;
  await db
    .update(requestsRequests)
    .set({ staffSeenAt: sql`coalesce(${requestsRequests.staffSeenAt}, now())`, staffUnreadMessageAt: null })
    .where(
      and(
        eq(requestsRequests.id, id),
        or(isNull(requestsRequests.staffSeenAt), isNotNull(requestsRequests.staffUnreadMessageAt)),
      ),
    );
  const [people, warehouses] = await Promise.all([getCustomersByIds([r.customerId]), listWarehouses()]);
  const names = new Map(warehouses.map((w) => [w.id, w.name]));
  return {
    ...r,
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
async function whileEditable(requestId: string, write: (tx: Tx) => Promise<void>): Promise<Result> {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(requestsRequests).where(eq(requestsRequests.id, requestId)).for("update");
    if (!r) return { ok: false, error: "درخواست پیدا نشد" };
    if (!canDo("staffEdit", effectiveStatus(r, new Date()))) return { ok: false, error: NOT_ALLOWED };
    await write(tx);
    return { ok: true };
  });
}

export async function editRow(
  rowId: string,
  v: { priceToman: number | null; quantity: number; isUnavailable: boolean; discountPercent: number },
): Promise<Result> {
  const [row] = await db.select({ requestId: requestsRows.requestId }).from(requestsRows).where(eq(requestsRows.id, rowId));
  if (!row) return { ok: false, error: "ردیف پیدا نشد" };
  return whileEditable(row.requestId, async (tx) => {
    await tx.update(requestsRows).set(v).where(eq(requestsRows.id, rowId));
  });
}

/** The «تخفیف» box beside the total: a discount on the whole invoice, while staff may edit rows. */
export async function setInvoiceDiscount(requestId: string, kind: DiscountKind, value: number): Promise<Result> {
  return whileEditable(requestId, async (tx) => {
    await tx
      .update(requestsRequests)
      .set({ discountKind: kind, discountValue: value })
      .where(eq(requestsRequests.id, requestId));
  });
}

export async function addRow(
  requestId: string,
  v: { code: string; name: string; priceToman: number | null; quantity: number | null; unit: "piece" | "pair" },
): Promise<Result> {
  let product: CartProduct | null = null;
  if (v.code) {
    product = await getProductForStaff(v.code);
    if (!product) return { ok: false, error: "کالایی با این کد فنی پیدا نشد" };
  }
  return whileEditable(requestId, async (tx) => {
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

export async function confirmRequest(requestId: string, hours: number | null, message: string): Promise<Result> {
  const res = await move(requestId, "confirm", null, {
    status: "confirmed",
    deadlineAt: deadlineFrom(hours, new Date()),
    customerNotifyAt: new Date(),
  }, {
    check: async (tx) => canConfirm(await tx.select().from(requestsRows).where(eq(requestsRows.requestId, requestId))),
  });
  if (res.ok && message) await db.insert(requestsMessages).values({ requestId, body: message });
  return res;
}

export const REOPEN_MESSAGE = "فاکتور شما در حال ویرایش است. بعد از تأیید دوباره خبرتان می‌کنیم.";

/**
 * Staff «ویرایش فاکتور» after confirming (or after the shopper accepted): the request goes back to
 * awaiting, the old invoice can no longer be accepted, and staff confirm again with a new deadline.
 */
export async function reopenRequest(requestId: string): Promise<Result> {
  const res = await move(requestId, "reopen", null, { status: "awaiting", deadlineAt: null, customerNotifyAt: new Date() });
  if (res.ok) await db.insert(requestsMessages).values({ requestId, body: REOPEN_MESSAGE });
  return res;
}

export async function rejectRequest(requestId: string, reason: string): Promise<Result> {
  return move(requestId, "reject", null, { status: "rejected", rejectReason: reason, customerNotifyAt: new Date() });
}