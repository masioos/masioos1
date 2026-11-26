import { describe, expect, it } from "vitest";
import {
  gatewayAmount,
  paymentDayOptions,
  paymentProgress,
  statusAfterPayments,
  beforePayment,
  canShip,
  defaultPayee,
  paidAtFrom,
  payeeSchema,
  paymentFormSchema,
  refundSchema,
  addRefundSchema,
  canCancelOrder,
  amountProblem,
  deliverySchema,
  refundable,
  HISTORY_LABELS,
  historyNote,
  hideStaffOnly,
  quantityTotal,
  staffTabOf,
  parseStaffTab,
  addRowSchema,
  canConfirm,
  canDo,
  canSubmit,
  cartTotal,
  clampQuantity,
  confirmSchema,
  deadlineFrom,
  effectiveStatus,
  requestTotal,
  rowTotal,
  rowProfit,
  profitTotal,
  invoiceTotals,
  invoiceDiscountSchema,
  rowEditSchema,
  type CartLine,
} from "./rules";

const line = (p: Partial<CartLine> = {}): CartLine => ({
  productId: "p",
  quantity: 1,
  unit: "piece",
  shopPriceToman: 1000,
  isActive: true,
  isUnavailable: false,
  ...p,
});

describe("cart", () => {
  it("quantity is capped: 5 pieces → 4, 3 pairs → 2, 0 → 1", () => {
    expect(clampQuantity(5, "piece")).toBe(4);
    expect(clampQuantity(3, "pair")).toBe(2);
    expect(clampQuantity(0, "piece")).toBe(1);
  });
  it("total skips lines without a price and says so", () => {
    expect(cartTotal([line({ shopPriceToman: 2_587_000, quantity: 2 }), line({ shopPriceToman: null })])).toEqual({
      total: 5_174_000,
      hasUnpriced: true,
    });
  });
  it("empty cart with a note can be sent; empty cart and empty note cannot", () => {
    expect(canSubmit([], "لنت ترمز سمند ۶ جفت").ok).toBe(true);
    expect(canSubmit([], "  ").ok).toBe(false);
  });
  it("a line that became unavailable or inactive blocks sending", () => {
    expect(canSubmit([line({ isUnavailable: true })], "").ok).toBe(false);
    expect(canSubmit([line({ isActive: false })], "").ok).toBe(false);
    expect(canSubmit([line()], "").ok).toBe(true);
  });
});

describe("request", () => {
  it("total skips rows marked unavailable", () => {
    expect(
      requestTotal([
        { quantity: 2, priceToman: 1000, isUnavailable: false },
        { quantity: 1, priceToman: 5000, isUnavailable: true },
      ]),
    ).toEqual({ total: 2000, hasUnpriced: false });
  });
  it("cannot confirm with an unpriced row, or with no row left", () => {
    expect(canConfirm([{ quantity: 1, priceToman: null, isUnavailable: false }]).ok).toBe(false);
    expect(canConfirm([{ quantity: 1, priceToman: 10, isUnavailable: true }]).ok).toBe(false);
    expect(canConfirm([{ quantity: 1, priceToman: 10, isUnavailable: false }]).ok).toBe(true);
  });
  it("deadline: empty → 12 hours; staff hours used; 0 and 169 refused", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    expect(deadlineFrom(null, now).toISOString()).toBe("2026-11-23T22:00:00.000Z");
    expect(deadlineFrom(24, now).toISOString()).toBe("2026-11-24T10:00:00.000Z");
    const id = "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f";
    expect(confirmSchema.parse({ requestId: id, hours: "" }).hours).toBeNull();
    expect(confirmSchema.parse({ requestId: id, hours: "۴۸" }).hours).toBe(48);
    expect(confirmSchema.safeParse({ requestId: id, hours: "0" }).success).toBe(false);
    expect(confirmSchema.safeParse({ requestId: id, hours: "169" }).success).toBe(false);
  });
  it("confirmed past its deadline is expired", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    expect(effectiveStatus({ status: "confirmed", deadlineAt: new Date("2026-11-23T09:59:00Z") }, now)).toBe("expired");
    expect(effectiveStatus({ status: "confirmed", deadlineAt: new Date("2026-11-23T10:01:00Z") }, now)).toBe("confirmed");
    // Accepted (awaiting payment): past the deadline with no payment form → expired; with one → not.
    expect(effectiveStatus({ status: "accepted", deadlineAt: new Date("2026-11-22T00:00:00Z"), paymentFormAt: null }, now)).toBe(
      "expired",
    );
    expect(
      effectiveStatus({ status: "accepted", deadlineAt: new Date("2026-11-22T00:00:00Z"), paymentFormAt: new Date("2026-11-21T00:00:00Z") }, now),
    ).toBe("accepted");
    expect(effectiveStatus({ status: "payment_sent", deadlineAt: new Date("2026-11-22T00:00:00Z") }, now)).toBe("payment_sent");
  });
  it("who may do what", () => {
    expect(canDo("cancel", "awaiting")).toBe(true);
    expect(canDo("cancel", "confirmed")).toBe(false);
    expect(canDo("accept", "confirmed")).toBe(true);
    expect(canDo("accept", "expired")).toBe(false);
    expect(canDo("staffEdit", "awaiting")).toBe(true);
    expect(canDo("staffEdit", "confirmed")).toBe(false);
    expect(canDo("reject", "accepted")).toBe(false);
    expect(canDo("reject", "confirmed")).toBe(true);
    expect(canDo("reopen", "confirmed")).toBe(true);
    expect(canDo("reopen", "expired")).toBe(true);
    expect(canDo("reopen", "accepted")).toBe(true);
    expect(canDo("reopen", "awaiting")).toBe(false);
    expect(canDo("reopen", "rejected")).toBe(false);
  });
  it("row edit reads Persian numbers; quantity is required", () => {
    const id = "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f";
    const r = rowEditSchema.parse({ rowId: id, priceToman: "۲٬۵۸۷٬۰۰۰", quantity: "۲", isUnavailable: "on" });
    expect(r).toEqual({ rowId: id, priceToman: 2_587_000, quantity: 2, isUnavailable: true, discountPercent: 0, manualProfitToman: null });
    expect(rowEditSchema.parse({ rowId: id, priceToman: "1000", quantity: "1", manualProfitToman: "12/000" }).manualProfitToman).toBe(12_000);
    // A loss is typed with a minus; a price never can be.
    expect(rowEditSchema.parse({ rowId: id, priceToman: "1000", quantity: "1", manualProfitToman: "-5/000" }).manualProfitToman).toBe(
      -5_000,
    );
    expect(rowEditSchema.safeParse({ rowId: id, priceToman: "-1000", quantity: "1" }).success).toBe(false);
    expect(rowEditSchema.parse({ rowId: id, priceToman: "1000", quantity: "1", discountPercent: "۵" }).discountPercent).toBe(5);
    expect(rowEditSchema.safeParse({ rowId: id, priceToman: "1000", quantity: "1", discountPercent: "120" }).success).toBe(false);
    // A price of 0 is a typo, not a free item (a free item is a 100% row discount).
    expect(rowEditSchema.safeParse({ rowId: id, priceToman: "0", quantity: "1" }).success).toBe(false);
    expect(rowEditSchema.safeParse({ rowId: id, priceToman: "", quantity: "" }).success).toBe(false);
  });
  it("adding a row needs a code or a name", () => {
    const id = "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f";
    expect(addRowSchema.safeParse({ requestId: id }).success).toBe(false);
    expect(addRowSchema.safeParse({ requestId: id, name: "لنت ترمز", priceToman: "500000" }).success).toBe(true);
  });
});

describe("row discount", () => {
  it("takes the percent off price × quantity, rounded to whole Toman", () => {
    expect(rowTotal({ priceToman: 1_000_000, quantity: 2 })).toBe(2_000_000);
    expect(rowTotal({ priceToman: 1_000_000, quantity: 2, discountPercent: 5 })).toBe(1_900_000);
    expect(rowTotal({ priceToman: 333, quantity: 1, discountPercent: 4 })).toBe(320);
  });
  it("counts discounts in the request total", () => {
    expect(
      requestTotal([
        { quantity: 1, priceToman: 100_000, isUnavailable: false, discountPercent: 5 },
        { quantity: 2, priceToman: 50_000, isUnavailable: false, discountPercent: 4 },
        { quantity: 1, priceToman: 70_000, isUnavailable: false },
      ]).total,
    ).toBe(95_000 + 96_000 + 70_000);
  });
});

describe("invoice discount", () => {
  const rows = [{ quantity: 2, priceToman: 500_000, isUnavailable: false }];
  it("takes a percent or an amount off the rows' sum", () => {
    expect(invoiceTotals(rows, { kind: "none", value: 0 })).toEqual({
      subtotal: 1_000_000,
      discount: 0,
      total: 1_000_000,
      hasUnpriced: false,
    });
    expect(invoiceTotals(rows, { kind: "percent", value: 10 }).total).toBe(900_000);
    expect(invoiceTotals(rows, { kind: "amount", value: 150_000 }).total).toBe(850_000);
    expect(invoiceTotals(rows, { kind: "amount", value: 5_000_000 }).total).toBe(0);
  });
  it("reads the form: unticked is no discount, percent at most 100", () => {
    const id = "6a2f1c3e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
    expect(invoiceDiscountSchema.parse({ requestId: id, kind: "percent", value: "10" })).toEqual({
      requestId: id,
      kind: "none",
      value: 0,
    });
    expect(invoiceDiscountSchema.parse({ requestId: id, enabled: "on", kind: "amount", value: "150/000" })).toEqual({
      requestId: id,
      kind: "amount",
      value: 150_000,
    });
    expect(invoiceDiscountSchema.safeParse({ requestId: id, enabled: "on", kind: "percent", value: "150" }).success).toBe(
      false,
    );
  });
});

describe("profit (staff only)", () => {
  it("is the row amount after its discount less purchase × quantity", () => {
    expect(rowProfit({ priceToman: 115_000, purchasePriceToman: 100_000, quantity: 2, isUnavailable: false })).toBe(30_000);
    expect(
      rowProfit({ priceToman: 115_000, purchasePriceToman: 100_000, quantity: 2, isUnavailable: false, discountPercent: 10 }),
    ).toBe(7_000);
    expect(rowProfit({ priceToman: 115_000, purchasePriceToman: null, quantity: 1, isUnavailable: false })).toBeNull();
    expect(rowProfit({ priceToman: 115_000, purchasePriceToman: 100_000, quantity: 1, isUnavailable: true })).toBeNull();
    // A free row (no purchase price) uses the profit staff typed.
    expect(rowProfit({ priceToman: 90_000, purchasePriceToman: null, manualProfitToman: 12_000, quantity: 3, isUnavailable: false })).toBe(
      12_000,
    );
    // A typed profit never overrides a known purchase price.
    expect(rowProfit({ priceToman: 115_000, purchasePriceToman: 100_000, manualProfitToman: 1, quantity: 1, isUnavailable: false })).toBe(
      15_000,
    );
  });
  it("totals rows, takes off the invoice discount, and flags unknown rows", () => {
    const rows = [
      { priceToman: 115_000, purchasePriceToman: 100_000, quantity: 2, isUnavailable: false },
      { priceToman: 50_000, purchasePriceToman: null, quantity: 1, isUnavailable: false },
      { priceToman: 90_000, purchasePriceToman: 10_000, quantity: 1, isUnavailable: true },
    ];
    expect(profitTotal(rows, 5_000)).toEqual({ total: 25_000, incomplete: true });
  });
});

describe("quantity total", () => {
  it("adds the units of available rows only", () => {
    expect(
      quantityTotal([
        { quantity: 2, isUnavailable: false },
        { quantity: 5, isUnavailable: true },
        { quantity: 3, isUnavailable: false },
      ]),
    ).toBe(5);
  });
});

describe("staff list tabs", () => {
  const seen = new Date();
  it("puts each status in its tab", () => {
    expect(staffTabOf({ status: "awaiting", staffSeenAt: null })).toBe("new");
    expect(staffTabOf({ status: "awaiting", staffSeenAt: seen })).toBe("working");
    expect(staffTabOf({ status: "confirmed", staffSeenAt: null })).toBe("working");
    expect(staffTabOf({ status: "accepted", staffSeenAt: null })).toBe("working");
    expect(staffTabOf({ status: "payment_sent", staffSeenAt: null })).toBe("working");
    for (const status of ["paid", "collecting", "shipped"] as const) expect(staffTabOf({ status, staffSeenAt: null })).toBe("paid");
    expect(staffTabOf({ status: "refunded", staffSeenAt: null })).toBe("void");
    for (const status of ["rejected", "cancelled", "declined", "expired"] as const) {
      expect(staffTabOf({ status, staffSeenAt: seen })).toBe("void");
    }
  });
  it("falls back to «تازه» for an unknown tab", () => {
    expect(parseStaffTab("paid")).toBe("paid");
    expect(parseStaffTab("x")).toBe("new");
    expect(parseStaffTab(undefined)).toBe("new");
  });
});

describe("shopper view", () => {
  it("never carries purchase price or typed profit", () => {
    const rows = hideStaffOnly([{ id: "a", purchasePriceToman: 100_000, manualProfitToman: 5_000 }]);
    expect(rows).toEqual([{ id: "a", purchasePriceToman: null, manualProfitToman: null }]);
  });
});

describe("request history", () => {
  it("names each kind of staff work", () => {
    expect(HISTORY_LABELS).toMatchObject({ confirm: "تأیید کرد", reject: "رد کرد", reopen: "ویرایش فاکتور", edit: "ویرایش کرد" });
    expect(HISTORY_LABELS.payment_confirmed).toBe("پرداخت را تأیید کرد");
    expect(historyNote("payee_card", 6)).toBe("فاکتور ۶: کارت مقصد را عوض کرد");
    expect(historyNote("shipped", 6)).toBe("فاکتور ۶ را ارسال کرد");
  });
  it("writes the staff member's last action with the request number", () => {
    expect(historyNote("confirm", 6)).toBe("فاکتور ۶ را تأیید کرد");
    expect(historyNote("reopen", 12)).toBe("فاکتور ۱۲ را برای ویرایش باز کرد");
    expect(historyNote("edit", 1005)).toBe("فاکتور ۱۰۰۵ را ویرایش کرد");
  });
});

describe("payment (card-to-card)", () => {
  const id = "6f1c2c1e-8a4b-4c55-9d7e-1a2b3c4d5e6f";
  it("each step only in its status", () => {
    expect(canDo("pay", "accepted")).toBe(true);
    expect(canDo("pay", "expired")).toBe(false);
    // Another card while the first form waits for staff.
    expect(canDo("pay", "payment_sent")).toBe(true);
    expect(canDo("pay", "paid")).toBe(false);
    expect(canDo("confirmPayment", "payment_sent")).toBe(true);
    expect(canDo("paymentNotFound", "payment_sent")).toBe(true);
    expect(canDo("confirmPayment", "accepted")).toBe(false);
    expect(canDo("collect", "paid")).toBe(true);
    expect(canDo("ship", "collecting")).toBe(true);
    expect(canDo("ship", "paid")).toBe(false);
    for (const s of ["paid", "collecting", "shipped"] as const) expect(canDo("refund", s)).toBe(true);
    for (const s of ["payment_sent", "refunded"] as const) expect(canDo("refund", s)).toBe(false);
    // An accepted order can be cancelled only after a payment form came.
    expect(canCancelOrder("accepted", null)).toBe(false);
    expect(canCancelOrder("accepted", new Date())).toBe(true);
    expect(canCancelOrder("paid", null)).toBe(true);
    // Money goes back only after payment, never while the shopper is still paying.
    for (const s of ["paid", "collecting", "shipped", "refunded"] as const) expect(canDo("addRefund", s)).toBe(true);
    for (const s of ["accepted", "payment_sent"] as const) expect(canDo("addRefund", s)).toBe(false);
    expect(canDo("setPayee", "accepted")).toBe(true);
    expect(canDo("setPayee", "paid")).toBe(false);
    expect(canDo("message", "shipped")).toBe(true);
    expect(canDo("shopperMessage", "refunded")).toBe(false);
  });
  it("reopen and a new payee card stop once a payment form arrived", () => {
    expect(beforePayment({ paymentFormAt: null })).toBe(true);
    expect(beforePayment({ paymentFormAt: new Date() })).toBe(false);
  });
  it("suggests the card of the warehouse with the largest share", () => {
    const cards = [
      { id: "a", cardNumber: "1111222233334444", cardHolder: "الف" },
      { id: "b", cardNumber: "5555666677778888", cardHolder: "ب" },
    ];
    const row = (warehouseId: string | null, priceToman: number | null, extra = {}) => ({
      warehouseId,
      priceToman,
      quantity: 1,
      isUnavailable: false,
      ...extra,
    });
    expect(defaultPayee([row("a", 100), row("b", 300)], cards)?.id).toBe("b");
    // Row discounts count: b 300 → 150 after 50%.
    expect(defaultPayee([row("a", 200), row("b", 300, { discountPercent: 50 })], cards)?.id).toBe("a");
    // Unavailable and unpriced rows do not count.
    expect(defaultPayee([row("a", 100), row("b", 900, { isUnavailable: true }), row("b", null)], cards)?.id).toBe("a");
    // A tie → the earlier row.
    expect(defaultPayee([row("b", 100), row("a", 100)], cards)?.id).toBe("b");
    // No warehouse → none.
    expect(defaultPayee([row(null, 100)], cards)).toBeNull();
  });
  it("reads the payment time in Tehran and refuses the future", () => {
    const now = new Date("2026-11-24T10:00:00Z"); // 13:30 in Tehran
    expect(paidAtFrom(0, 13, 0, now)?.toISOString()).toBe("2026-11-24T09:30:00.000Z");
    expect(paidAtFrom(1, 23, 0, now)?.toISOString()).toBe("2026-11-23T19:30:00.000Z");
    expect(paidAtFrom(6, 8, 15, now)?.toISOString()).toBe("2026-11-18T04:45:00.000Z");
    expect(paidAtFrom(0, 14, 0, now)).toBeNull();
    // The day list: 7 days, today and yesterday named, Persian dates.
    const days = paymentDayOptions(now);
    expect(days).toHaveLength(7);
    expect(days[0].label.startsWith("امروز، ")).toBe(true);
    expect(days[1].label.startsWith("دیروز، ")).toBe(true);
    expect(days[0].label).toContain("آذر");
  });
  it("checks the payment form", () => {
    const ok = { requestId: id, tracking: "۱۲۳۴۵۶", cardLast4: "۴۴۵۵", paidDay: "1", paidHour: "9", paidMinute: "5", payeeCard: "6037997512345678" };
    expect(paymentFormSchema.parse(ok)).toMatchObject({
      tracking: "123456",
      cardLast4: "4455",
      paidDay: 1,
      paidHour: 9,
      paidMinute: 5,
      amount: null,
      receiptFile: null,
    });
    expect(paymentFormSchema.parse({ ...ok, amount: "۲/۰۰۰/۰۰۰" }).amount).toBe(2_000_000);
    expect(paymentFormSchema.safeParse({ ...ok, amount: "0" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...ok, receiptFile: "../.env" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...ok, tracking: "12" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...ok, cardLast4: "123" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...ok, paidHour: "24" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...ok, paidDay: "7" }).success).toBe(false);
  });
  it("checks a typed payee card and its holder", () => {
    expect(payeeSchema.parse({ mode: "other", requestId: id, cardNumber: "۶۰۳۷ ۹۹۷۵ ۱۲۳۴ ۵۶۷۸", cardHolder: "رضا احمدی" })).toMatchObject({
      cardNumber: "6037997512345678",
    });
    expect(payeeSchema.safeParse({ mode: "other", requestId: id, cardNumber: "1234", cardHolder: "رضا احمدی" }).success).toBe(false);
    expect(payeeSchema.safeParse({ mode: "other", requestId: id, cardNumber: "6037997512345678", cardHolder: "" }).success).toBe(false);
    expect(payeeSchema.safeParse({ mode: "warehouse", requestId: id, warehouseId: id }).success).toBe(true);
  });
  it("asks the delivery method once, on its own", () => {
    expect(deliverySchema.safeParse({ requestId: id, deliveryMethod: "tipax" }).success).toBe(true);
    expect(deliverySchema.safeParse({ requestId: id, deliveryMethod: "camel" }).success).toBe(false);
    expect(deliverySchema.safeParse({ requestId: id }).success).toBe(false);
  });
  it("checks the typed amount while it is typed", () => {
    expect(amountProblem(null, 500)).toBeNull();
    expect(amountProblem(500, 500)).toBeNull();
    expect(amountProblem(501, 500)).not.toBeNull();
    expect(amountProblem(0, 500)).not.toBeNull();
  });
  it("checks a refund transfer and what is left to send back", () => {
    expect(addRefundSchema.parse({ requestId: id, amount: "۲۰۰/۰۰۰", tracking: "۱۲۳۴۵" })).toMatchObject({
      amount: 200_000,
      tracking: "12345",
      receiptFile: null,
    });
    expect(addRefundSchema.safeParse({ requestId: id, amount: "", tracking: "12345" }).success).toBe(false);
    expect(addRefundSchema.safeParse({ requestId: id, amount: "1000", tracking: "1" }).success).toBe(false);
    expect(addRefundSchema.safeParse({ requestId: id, amount: "1000", tracking: "12345", receiptFile: "../x" }).success).toBe(false);
    expect(refundable(1000, [{ amountToman: 300 }, { amountToman: 200 }])).toBe(500);
    expect(refundable(1000, [{ amountToman: 1200 }])).toBe(0);
  });
  it("needs a tracking code to ship by Tipax or post, and a reason to refund", () => {
    expect(canShip("tipax", "").ok).toBe(false);
    expect(canShip("post", "123").ok).toBe(true);
    expect(canShip("courier", "").ok).toBe(true);
    expect(canShip("pickup", "").ok).toBe(true);
    expect(refundSchema.safeParse({ requestId: id, reason: "" }).success).toBe(false);
    expect(refundSchema.safeParse({ requestId: id, reason: "کالا نبود" }).success).toBe(true);
  });
});

describe("several payments (more than one card)", () => {
  const p = (amountToman: number, verdict: "pending" | "confirmed" | "not_found") => ({ amountToman, verdict });
  it("adds up confirmed and waiting forms; «پیدا نشد» does not count", () => {
    expect(paymentProgress(1000, [p(300, "confirmed"), p(200, "pending"), p(500, "not_found")])).toEqual({
      confirmed: 300,
      pending: 200,
      remaining: 500,
    });
    expect(paymentProgress(1000, [p(1200, "pending")]).remaining).toBe(0);
  });
  it("is paid only when confirmed forms cover the total", () => {
    expect(statusAfterPayments(1000, [p(600, "confirmed"), p(400, "confirmed")])).toBe("paid");
    expect(statusAfterPayments(1000, [p(600, "confirmed"), p(400, "pending")])).toBe("payment_sent");
    expect(statusAfterPayments(1000, [p(600, "confirmed"), p(400, "not_found")])).toBe("accepted");
    expect(statusAfterPayments(1000, [])).toBe("accepted");
  });
  it("the gateway adds the tax percent", () => {
    expect(gatewayAmount(1_000_000, 10)).toBe(1_100_000);
    expect(gatewayAmount(8_605_000, 15)).toBe(9_895_750);
    expect(gatewayAmount(1000, 0)).toBe(1000);
  });
});
