import { describe, expect, it } from "vitest";
import {
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
    expect(effectiveStatus({ status: "accepted", deadlineAt: new Date("2026-11-22T00:00:00Z") }, now)).toBe("accepted");
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
    expect(staffTabOf({ status: "accepted", staffSeenAt: null })).toBe("paid");
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
