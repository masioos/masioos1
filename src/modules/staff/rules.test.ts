import { describe, expect, it } from "vitest";
import {
  addSellerSchema,
  editSellerSchema,
  can,
  canSee,
  IDLE_HOURS,
  isLocked,
  LOCK_MINUTES,
  MAX_FAILED_SIGN_INS,
  newPassword,
  PASSWORD_ALPHABET,
  PASSWORD_LENGTH,
  staffLoginSchema,
  switchSchema,
} from "./rules";

const manager = { role: "manager", canSeePurchasePrice: false, canSeeProfit: false } as const;
const seller = { role: "seller", canSeePurchasePrice: false, canSeeProfit: false } as const;

describe("permissions", () => {
  it("the manager always sees purchase price and profit", () => {
    expect(canSee(manager, "purchasePrice")).toBe(true);
    expect(canSee(manager, "profit")).toBe(true);
  });
  it("a seller sees each one only with its own switch", () => {
    expect(canSee(seller, "purchasePrice")).toBe(false);
    expect(canSee(seller, "profit")).toBe(false);
    const profitOnly = { ...seller, canSeeProfit: true };
    expect(canSee(profitOnly, "profit")).toBe(true);
    expect(canSee(profitOnly, "purchasePrice")).toBe(false);
    const priceOnly = { ...seller, canSeePurchasePrice: true };
    expect(canSee(priceOnly, "purchasePrice")).toBe(true);
    expect(canSee(priceOnly, "profit")).toBe(false);
  });
  it("only the manager manages staff, settings, warehouses and products", () => {
    for (const a of ["manageStaff", "settings", "warehouses", "editProducts"] as const) {
      expect(can(manager, a)).toBe(true);
      expect(can(seller, a)).toBe(false);
    }
  });
});

describe("sessions", () => {
  it("end after 6 idle hours", () => {
    expect(IDLE_HOURS).toBe(6);
  });
});

describe("new password", () => {
  it("is 10 easy-to-read letters and digits, different each time", () => {
    const a = newPassword();
    expect(a).toHaveLength(PASSWORD_LENGTH);
    expect([...a].every((c) => PASSWORD_ALPHABET.includes(c))).toBe(true);
    expect(a).not.toMatch(/[01ol]/);
    expect(newPassword()).not.toBe(a);
  });
});

describe("forms", () => {
  it("sign-in takes a mobile in any form and needs a password", () => {
    expect(staffLoginSchema.parse({ mobile: "۰۹۱۲ ۳۴۵ ۶۷۸۹", password: "x" }).mobile).toBe("09123456789");
    expect(staffLoginSchema.safeParse({ mobile: "09123456789", password: "" }).success).toBe(false);
    expect(staffLoginSchema.safeParse({ mobile: "12345", password: "x" }).success).toBe(false);
  });
  it("a new seller needs a full name and a mobile", () => {
    expect(addSellerSchema.parse({ fullName: "  علی   رضایی ", mobile: "+989121112233" })).toEqual({
      fullName: "علی رضایی",
      mobile: "09121112233",
    });
    expect(addSellerSchema.safeParse({ fullName: "ع", mobile: "09121112233" }).success).toBe(false);
  });
  it("editing a seller names the person and checks name and mobile again", () => {
    const id = "6f1c2c1e-8a4b-4c55-9d7e-1a2b3c4d5e6f";
    expect(editSellerSchema.parse({ staffId: id, fullName: "علی رضایی", mobile: "۰۹۱۲۱۱۱۲۲۳۳" }).mobile).toBe("09121112233");
    expect(editSellerSchema.safeParse({ staffId: id, fullName: "علی رضایی", mobile: "123" }).success).toBe(false);
    expect(editSellerSchema.safeParse({ fullName: "علی رضایی", mobile: "09121112233" }).success).toBe(false);
  });
  it("a switch names the person, which switch, and on or off", () => {
    const id = "6f1c2c1e-8a4b-4c55-9d7e-1a2b3c4d5e6f";
    expect(switchSchema.parse({ staffId: id, which: "profit", on: "true" })).toEqual({ staffId: id, which: "profit", on: true });
    expect(switchSchema.safeParse({ staffId: id, which: "role", on: "true" }).success).toBe(false);
  });
});

describe("wrong passwords", () => {
  it("close sign-in for a mobile after 5 within 15 minutes", () => {
    expect(MAX_FAILED_SIGN_INS).toBe(5);
    expect(LOCK_MINUTES).toBe(15);
    expect(isLocked(4)).toBe(false);
    expect(isLocked(5)).toBe(true);
  });
});
