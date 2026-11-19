import { describe, expect, it } from "vitest";
import { newWarehouseSchema, normalizeCardNumber } from "./rules";

describe("normalizeCardNumber", () => {
  it("turns Persian digits with dashes into 16 ASCII digits", () => {
    expect(normalizeCardNumber("۶۰۳۷-۹۹۷۵-۱۲۳۴-۵۶۷۸")).toBe("6037997512345678");
  });
});

describe("newWarehouseSchema", () => {
  it("accepts a valid warehouse", () => {
    const result = newWarehouseSchema.safeParse({
      name: "انبار آقای الف",
      ownerName: "آقای الف",
      cardNumber: "6037 9975 1234 5678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a card number that is not 16 digits", () => {
    const result = newWarehouseSchema.safeParse({
      name: "انبار آقای الف",
      ownerName: "آقای الف",
      cardNumber: "1234",
    });
    expect(result.success).toBe(false);
  });
});
