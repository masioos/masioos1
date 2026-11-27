import { describe, expect, it } from "vitest";
import {
  formatProfitPercent,
  newWarehouseSchema,
  normalizeCardNumber,
  parseProfitPercent,
  moveInOrder,
  profitPercentSchema,
  setInfoSchema,
} from "./rules";

describe("normalizeCardNumber", () => {
  it("turns Persian digits with dashes into 16 ASCII digits", () => {
    expect(normalizeCardNumber("۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸")).toBe("6037997512345678");
  });
});

describe("newWarehouseSchema", () => {
  const valid = {
    name: "انبار آقای الف",
    ownerName: "آقای الف",
    cardNumber: "6037 9975 1234 5678",
    cardHolder: "رضا احمدی",
    profitBp: "10",
  };

  it("accepts a valid warehouse and turns the profit into basis points", () => {
    const result = newWarehouseSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data?.profitBp).toBe(1000);
  });

  it("rejects a card number that is not 16 digits", () => {
    expect(newWarehouseSchema.safeParse({ ...valid, cardNumber: "1234" }).success).toBe(false);
    // The card holder is required (it is shown to shoppers who pay).
    expect(newWarehouseSchema.safeParse({ ...valid, cardHolder: "" }).success).toBe(false);
  });

  it("rejects a profit above 100", () => {
    expect(newWarehouseSchema.safeParse({ ...valid, profitBp: "101" }).success).toBe(false);
  });
});

describe("parseProfitPercent", () => {
  it("reads Persian digits: «۱۰» → 1000 bp", () => {
    expect(parseProfitPercent("۱۰")).toBe(1000);
  });
  it("reads decimals: 12.5 → 1250, «۱۲٫۵» → 1250, 0.25 → 25", () => {
    expect(parseProfitPercent("12.5")).toBe(1250);
    expect(parseProfitPercent("۱۲٫۵")).toBe(1250);
    expect(parseProfitPercent("۱۲/۵")).toBe(1250);
    expect(parseProfitPercent("0.25")).toBe(25);
  });
  it("accepts 0, 100 and a percent sign", () => {
    expect(parseProfitPercent("0")).toBe(0);
    expect(parseProfitPercent("100")).toBe(10_000);
    expect(parseProfitPercent("20%")).toBe(2000);
  });
  it("refuses −1, 101, three decimals and text", () => {
    expect(parseProfitPercent("-1")).toBeNull();
    expect(parseProfitPercent("101")).toBeNull();
    expect(parseProfitPercent("1.234")).toBeNull();
    expect(parseProfitPercent("ده")).toBeNull();
    expect(parseProfitPercent("")).toBeNull();
  });
});

describe("formatProfitPercent", () => {
  it("shows basis points as a short percent", () => {
    expect(formatProfitPercent(1000)).toBe("10");
    expect(formatProfitPercent(1250)).toBe("12.5");
    expect(formatProfitPercent(25)).toBe("0.25");
  });
});


describe("setInfoSchema", () => {
  const id = "6f1c2c1e-8a4b-4c55-9d7e-1a2b3c4d5e6f";
  it("needs a name and an owner of at least 2 letters", () => {
    expect(setInfoSchema.safeParse({ id, name: " انبار رضا ", ownerName: "رضا" }).success).toBe(true);
    expect(setInfoSchema.safeParse({ id, name: "ا", ownerName: "رضا" }).success).toBe(false);
    expect(setInfoSchema.safeParse({ id, name: "انبار", ownerName: "" }).success).toBe(false);
  });
});

describe("moveInOrder", () => {
  it("moves one place up or down, and not past the top or bottom", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moveInOrder(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
  });
});

describe("profitPercentSchema", () => {
  it("an empty box is 0%", () => {
    expect(profitPercentSchema.parse("")).toBe(0);
    expect(profitPercentSchema.parse("  ")).toBe(0);
    expect(profitPercentSchema.parse("5")).toBe(500);
  });
});
