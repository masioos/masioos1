import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";
import { addressSchema, loginSchema, normalizeMobile, registerSchema, safeNextPath } from "./rules";

describe("normalizeMobile", () => {
  it("Persian digits with spaces, +98, 98 and 0098 → 09…", () => {
    expect(normalizeMobile("۰۹۱۲ ۳۴۵ ۶۷۸۹")).toBe("09123456789");
    expect(normalizeMobile("+989123456789")).toBe("09123456789");
    expect(normalizeMobile("989123456789")).toBe("09123456789");
    expect(normalizeMobile("00989123456789")).toBe("09123456789");
    expect(normalizeMobile("9123456789")).toBe("09123456789");
  });
});

describe("registerSchema", () => {
  const valid = { fullName: "علی  رضایی", mobile: "09123456789", password: "123456" };
  it("accepts a shopper; email optional", () => {
    const r = registerSchema.parse(valid);
    expect(r.fullName).toBe("علی رضایی");
    expect(r.email).toBeNull();
  });
  it("refuses a landline", () => {
    expect(registerSchema.safeParse({ ...valid, mobile: "02112345678" }).success).toBe(false);
  });
  it("refuses a password shorter than 6", () => {
    expect(registerSchema.safeParse({ ...valid, password: "12345" }).success).toBe(false);
  });
  it("an email, if given, must be valid", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(registerSchema.parse({ ...valid, email: "A@B.ir" }).email).toBe("a@b.ir");
  });
  it("name and mobile are required", () => {
    expect(registerSchema.safeParse({ ...valid, fullName: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ mobile: "", password: "x" }).success).toBe(false);
  });
});

describe("password", () => {
  it("round trip; wrong password is false; same password gives a different hash", () => {
    const h = hashPassword("سلام123");
    expect(verifyPassword("سلام123", h)).toBe(true);
    expect(verifyPassword("سلام124", h)).toBe(false);
    expect(hashPassword("سلام123")).not.toBe(h);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("address and next path", () => {
  it("address needs 10 letters", () => {
    expect(addressSchema.safeParse("تهران").success).toBe(false);
    expect(addressSchema.safeParse("تهران، خیابان آزادی، پلاک ۱۲").success).toBe(true);
  });
  it("after sign-in only same-site paths", () => {
    expect(safeNextPath("/cart")).toBe("/cart");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
