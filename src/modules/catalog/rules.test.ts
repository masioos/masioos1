import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  canAddToCart,
  detectImageType,
  formatToman,
  isSafePhotoName,
  normalizeCode,
  normalizeSearch,
  parseStockSheetRows,
  productFormSchema,
  rialToToman,
  searchWords,
  shopPriceToman,
} from "./rules";

describe("shopPriceToman (brief: purchase + warehouse profit, rounded down to 1,000)", () => {
  it("2,352,000 at 10% → 2,587,000", () => {
    expect(shopPriceToman(2_352_000, 1000)).toBe(2_587_000);
  });
  it("2,352,000 at 20% → 2,822,000", () => {
    expect(shopPriceToman(2_352_000, 2000)).toBe(2_822_000);
  });
  it("2,352,000 at 0% stays 2,352,000", () => {
    expect(shopPriceToman(2_352_000, 0)).toBe(2_352_000);
  });
  it("999 at 0% → 0", () => {
    expect(shopPriceToman(999, 0)).toBe(0);
  });
  it("always rounds down: 2,587,999 at 0% → 2,587,000", () => {
    expect(shopPriceToman(2_587_999, 0)).toBe(2_587_000);
  });
  it("12.5% works in whole numbers: 1,000,000 → 1,125,000", () => {
    expect(shopPriceToman(1_000_000, 1250)).toBe(1_125_000);
  });
  it("no price stays no price", () => {
    expect(shopPriceToman(null, 1000)).toBeNull();
  });
});

describe("rialToToman", () => {
  it("23,520,000 rial → 2,352,000 toman", () => {
    expect(rialToToman(23_520_000)).toBe(2_352_000);
  });
  it("rounds down: 23,520,005 → 2,352,000", () => {
    expect(rialToToman(23_520_005)).toBe(2_352_000);
  });
  it("0 or empty → no price", () => {
    expect(rialToToman(0)).toBeNull();
    expect(rialToToman(null)).toBeNull();
    expect(rialToToman(undefined)).toBeNull();
  });
});

describe("formatToman", () => {
  it("uses Persian digits and separators", () => {
    expect(formatToman(2_587_000)).toBe("۲٬۵۸۷٬۰۰۰ تومان");
  });
});

describe("normalizeSearch", () => {
  it("«بلبرينگ» with Arabic ي matches «بلبرینگ»", () => {
    expect(normalizeSearch("بلبرينگ")).toBe(normalizeSearch("بلبرینگ"));
  });
  it("Persian digits become ASCII", () => {
    expect(normalizeSearch("۰۲۷۰۲۰۲۴۲۰")).toBe("0270202420");
  });
  it("half-space, Arabic kaf, case and extra spaces", () => {
    expect(normalizeSearch("  ديسك‌چرخ   ISACO ")).toBe("دیسک چرخ isaco");
  });
  it("search text holds name, code and brand; each query word is found in it", () => {
    const text = buildSearchText("بلبرینگ چرخ جلو - ژاپن - پژو 405", "0270202420", "ایساکو");
    for (const q of ["0270202420", "بلبرينگ", "ایساکو", "بلبرینگ ۴۰۵"]) {
      expect(searchWords(q).every((w) => text.includes(w))).toBe(true);
    }
  });
});

describe("normalizeCode", () => {
  it("drops dashes and spaces, Persian digits → ASCII", () => {
    expect(normalizeCode("۰۲۷۰-۲۰۲ ۴۲۰")).toBe("0270202420");
  });
});

describe("canAddToCart", () => {
  it("inactive → false", () => {
    expect(canAddToCart({ isActive: false, isUnavailable: false })).toBe(false);
  });
  it("unavailable → false", () => {
    expect(canAddToCart({ isActive: true, isUnavailable: true })).toBe(false);
  });
  it("active and available (even with no price) → true", () => {
    expect(canAddToCart({ isActive: true, isUnavailable: false })).toBe(true);
  });
});

describe("productFormSchema", () => {
  const valid = {
    warehouseId: "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f",
    code: "0270202420",
    name: "بلبرینگ چرخ جلو",
    purchasePriceToman: "۲٬۳۵۲٬۰۰۰",
  };
  it("accepts a product and reads a Persian price", () => {
    const r = productFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.purchasePriceToman).toBe(2_352_000);
    expect(r.data?.brandId).toBeNull();
  });
  it("empty price means no price", () => {
    expect(productFormSchema.parse({ ...valid, purchasePriceToman: "" }).purchasePriceToman).toBeNull();
  });
  it("code is required", () => {
    expect(productFormSchema.safeParse({ ...valid, code: " - " }).success).toBe(false);
  });
  it("name needs 2 letters", () => {
    expect(productFormSchema.safeParse({ ...valid, name: "ب" }).success).toBe(false);
  });
  it("price cannot be negative or text", () => {
    expect(productFormSchema.safeParse({ ...valid, purchasePriceToman: "-5" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...valid, purchasePriceToman: "abc" }).success).toBe(false);
  });
});

describe("parseStockSheetRows (shaped like Mojoodi_4104070_*.xlsx)", () => {
  const sheet = [
    ["فهرست موجودی و قیمت قطعات فروشگاه (ایساکو و انبار)", null, null, null, null],
    ["تاریخ تهیه گزارش: 1405/08/30", null, null, null, null],
    [null, null, null, null, null],
    ["ردیف", "کد فنی قطعه", "نام قطعه", "گروه خودرو", "قیمت فروش (ریال)"],
    [1, "0270202420", "بلبرینگ چرخ جلو - ژاپن - پژو 405", "پژو 405", 23_520_000],
    [2, "0690501199", "آلترناتور 80 آمپر", "پژو 405", 0],
    [3, null, "بدون کد", "سمند", 1000],
    [4, "0030100599", "آرم GLX", "پژو 405", "abc"],
    [null, null, null, null, null],
  ];

  it("finds the header on row 4 and reads code, name, car and price", () => {
    const r = parseStockSheetRows(sheet);
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({
      row: 5,
      code: "0270202420",
      name: "بلبرینگ چرخ جلو - ژاپن - پژو 405",
      car: "پژو 405",
      purchaseToman: 2_352_000,
    });
  });
  it("price 0 → no price", () => {
    const r = parseStockSheetRows(sheet);
    expect(r.ok && r.rows[1].purchaseToman).toBeNull();
  });
  it("a row without code and a bad price are reported with their Excel row", () => {
    const r = parseStockSheetRows(sheet);
    expect(r.ok && r.errors.map((e) => e.row)).toEqual([7, 8]);
  });
  it("a code repeated inside the file is reported", () => {
    const r = parseStockSheetRows([...sheet.slice(0, 5), sheet[4]]);
    expect(r.ok && r.errors[0]?.reason).toBe("این کد در فایل تکراری است");
  });
  it("a sheet without the columns is refused", () => {
    expect(parseStockSheetRows([["a", "b"]]).ok).toBe(false);
  });
});

describe("photos", () => {
  it("only accepts names the app wrote", () => {
    expect(isSafePhotoName("6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f.jpg")).toBe(true);
    expect(isSafePhotoName("../.env")).toBe(false);
    expect(isSafePhotoName("6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f.svg")).toBe(false);
  });
  it("detects the real image type from its bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(detectImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("webp");
    expect(detectImageType(new TextEncoder().encode("<svg>"))).toBeNull();
  });
});
