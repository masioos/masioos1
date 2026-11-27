import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  canAddToCart,
  detectImageType,
  formatToman,
  isSafePhotoName,
  isUuid,
  maxQuantity,
  unitPriceLabel,
  normalizeName,
  normalizeCode,
  normalizeSearch,
  parseStockSheetRows,
  planStockImport,
  shopName,
  makeListCodes,
  withBrand,
  fixLamAlef,
  parsePriceListLines,
  pdfListToStockRows,
  waitingToApply,
  sheetModeFor,
  parseIsacoSheet,
  planIsacoPrices,
  isBigJump,
  priceMove,
  type ExistingGood,
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
    expect(formatToman(2_587_000)).toBe("۲/۵۸۷/۰۰۰ تومان");
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
  it("«ارم» finds «آرم», and other letter forms fold together", () => {
    expect(normalizeSearch("آرم")).toBe(normalizeSearch("ارم"));
    expect(normalizeSearch("إسکله أصلی")).toBe("اسکله اصلی");
    expect(normalizeSearch("خانۀ")).toBe("خانه");
    expect(normalizeSearch("مسئول مؤسسه")).toBe("مسیول موسسه");
    expect(normalizeSearch("قطعـه")).toBe("قطعه");
    expect(normalizeSearch("مُهره")).toBe("مهره");
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

describe("review fixes", () => {
  const valid = {
    warehouseId: "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f",
    code: "0270202420",
    name: "بلبرینگ چرخ جلو",
  };
  it("a code with / # ? or % is refused, so /p/<code> is always a clean link", () => {
    for (const code of ["AB/12", "AB#1", "A?B", "10%"]) {
      expect(productFormSchema.safeParse({ ...valid, code }).success).toBe(false);
    }
    expect(productFormSchema.safeParse({ ...valid, code: "ab.12" }).data?.code).toBe("AB.12");
  });
  it("a price above the maximum is refused", () => {
    expect(productFormSchema.safeParse({ ...valid, purchasePriceToman: "9".repeat(16) }).success).toBe(false);
  });
  it("a car picked twice is kept once", () => {
    const id = "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f";
    expect(productFormSchema.parse({ ...valid, carIds: [id, id] }).carIds).toEqual([id]);
  });
  it("car names from staff and from Excel get one spelling", () => {
    expect(normalizeName("  پژو   ۴۰۵ ")).toBe("پژو 405");
    expect(normalizeName("سمند")).toBe(normalizeName("سمند"));
    expect(normalizeName("ديسك")).toBe("دیسک");
  });
  it("the sheet parser refuses a bad code and a huge price, and normalizes the car", () => {
    const r = parseStockSheetRows([
      ["کد فنی قطعه", "نام قطعه", "گروه خودرو", "قیمت فروش (ریال)"],
      ["AB/1", "قطعه یک", "پژو 405", 1000],
      ["X1", "قطعه دو", "پژو 405", 1e20],
      ["X2", "قطعه سه", " پژو  ۴۰۵ ", 1000],
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(r.rows[0].car).toBe("پژو 405");
  });
});

describe("isUuid", () => {
  it("refuses 36 dashes", () => {
    expect(isUuid("-".repeat(36))).toBe(false);
    expect(isUuid("6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f")).toBe(true);
  });
});

describe("unit", () => {
  it("label next to the price", () => {
    expect(unitPriceLabel("piece")).toBe("قیمت یک عدد");
    expect(unitPriceLabel("pair")).toBe("قیمت یک جفت");
  });
  it("cart limit: 4 pieces or 2 pairs", () => {
    expect(maxQuantity("piece")).toBe(4);
    expect(maxQuantity("pair")).toBe(2);
  });
  it("form unit defaults to piece and refuses other values", () => {
    const base = { warehouseId: "6f1c1f3e-8a1b-4c2d-9e3f-0a1b2c3d4e5f", code: "X1", name: "قطعه" };
    expect(productFormSchema.parse(base).unit).toBe("piece");
    expect(productFormSchema.safeParse({ ...base, unit: "box" }).success).toBe(false);
  });
});

describe("planStockImport (#2)", () => {
  const W = "w-1";
  const row = (code: string, purchaseToman: number | null = 1000) => ({ row: 5, code, name: `کالا ${code}`, car: null, purchaseToman });
  const good = (code: string, extra: Partial<ExistingGood> = {}): ExistingGood => ({
    id: `id-${code}`,
    code,
    name: `کالا ${code}`,
    warehouseId: W,
    purchasePriceToman: 1000,
    fromSheet: true,
    isUnavailable: false,
    unavailableSource: null,
    ...extra,
  });
  const plan = (rows: ReturnType<typeof row>[], existing: ExistingGood[], opts: { mode?: "stock_and_price" | "stock_only"; selected?: string[] } = {}) =>
    planStockImport({ warehouseId: W, mode: opts.mode ?? "stock_and_price", rows, existing, selectedNew: new Set(opts.selected ?? []) });

  it("a sheet good missing from the sheet goes «ناموجود»", () => {
    const p = plan([row("1"), row("2")], [good("1"), good("2"), good("3")]);
    expect(p.makeUnavailable.map((g) => g.code)).toEqual(["3"]);
  });
  it("a good the sheet made «ناموجود» is available again when the sheet has it", () => {
    const p = plan([row("1")], [good("1", { isUnavailable: true, unavailableSource: "sheet" })]);
    expect(p.makeAvailable.map((g) => g.code)).toEqual(["1"]);
  });
  it("a good made «ناموجود» by hand stays so, even if the sheet has it", () => {
    const p = plan([row("1")], [good("1", { isUnavailable: true, unavailableSource: "hand" })]);
    expect(p.makeAvailable).toEqual([]);
  });
  it("a good made by hand (never in a sheet) is left alone when missing", () => {
    const p = plan([row("1")], [good("1"), good("9", { fromSheet: false })]);
    expect(p.makeUnavailable).toEqual([]);
  });
  it("«فقط موجودی» never changes a price and creates new goods without price", () => {
    const p = plan([row("1", 5000), row("2", 7000)], [good("1")], { mode: "stock_only", selected: ["2"] });
    expect(p.priceUpdates).toEqual([]);
    expect(p.create).toEqual([{ ...row("2", 7000), purchaseToman: null }]);
  });
  it("«موجودی و قیمت» updates a changed price and creates new goods with the sheet price", () => {
    const p = plan([row("1", 5000), row("2", 7000), row("3", 1000)], [good("1"), good("3")], { selected: ["2"] });
    expect(p.priceUpdates).toEqual([{ id: "id-1", code: "1", name: "کالا 1", oldToman: 1000, purchaseToman: 5000 }]);
    expect(p.create).toEqual([row("2", 7000)]);
  });
  it("a new code is listed, and created only when ticked", () => {
    const p = plan([row("2"), row("3")], [], { selected: ["3"] });
    expect(p.newRows.map((r) => r.code)).toEqual(["2", "3"]);
    expect(p.create.map((r) => r.code)).toEqual(["3"]);
  });
  it("a code of another warehouse is skipped", () => {
    const p = plan([row("1")], [good("1", { warehouseId: "w-2" })]);
    expect(p.skipped).toHaveLength(1);
    expect(p.matched).toEqual([]);
  });
  it("asks first when more than half of the sheet goods would go «ناموجود»; exactly half does not", () => {
    expect(plan([row("1")], [good("1"), good("2"), good("3")]).needsConfirm).toBe(true);
    expect(plan([row("1"), row("2")], [good("1"), good("2"), good("3"), good("4")]).needsConfirm).toBe(false);
    expect(plan([], [good("1", { fromSheet: false })]).needsConfirm).toBe(false);
  });
});

describe("priceMove", () => {
  it("gives the change in Toman and in percent of the old price, one decimal", () => {
    expect(priceMove(100_000, 110_000)).toEqual({ amount: 10_000, percent: 10 });
    expect(priceMove(300_000, 200_000)).toEqual({ amount: -100_000, percent: -33.3 });
  });
  it("has no amount or percent without both prices; no percent from 0", () => {
    expect(priceMove(null, 5000)).toEqual({ amount: null, percent: null });
    expect(priceMove(5000, null)).toEqual({ amount: null, percent: null });
    expect(priceMove(0, 5000)).toEqual({ amount: 5000, percent: null });
  });
});

describe("planStockImport with rejected rows", () => {
  const good: ExistingGood = {
    id: "id-1",
    code: "111",
    name: "کالا",
    warehouseId: "w-1",
    purchasePriceToman: 1000,
    fromSheet: true,
    isUnavailable: false,
    unavailableSource: null,
  };
  it("a sheet good whose row has a bad price is still in the sheet, not «ناموجود»", () => {
    const p = planStockImport({
      warehouseId: "w-1",
      mode: "stock_and_price",
      rows: [],
      existing: [good],
      selectedNew: new Set(),
      rejected: [{ row: 5, code: "111", reason: "قیمت نامعتبر است" }],
    });
    expect(p.makeUnavailable).toEqual([]);
    expect(p.needsConfirm).toBe(false);
  });
  it("a row with an empty code does not keep anything in the sheet", () => {
    const p = planStockImport({
      warehouseId: "w-1",
      mode: "stock_and_price",
      rows: [],
      existing: [good],
      selectedNew: new Set(),
      rejected: [{ row: 5, code: "", reason: "کد فنی خالی است" }],
    });
    expect(p.makeUnavailable.map((g) => g.code)).toEqual(["111"]);
  });
});

describe("parseIsacoSheet (#8)", () => {
  const header = ["کد تدارکاتی", "شرح تدارکاتی", "مصرف خودرو", "واحد سنجش", "تعداد در بسته", "قیمت خرده فروشی", "قیمت با ارزش افزوده"];
  it("finds the columns, reads Rial as Toman, and 0 / empty as no price", () => {
    const res = parseIsacoSheet([
      header,
      ["0010201299", "آينه داخل", "پژو پارس", "عدد", 1, 8400000, 9240000],
      ["۰۰۳۰-۱۰۰۵۹۹", "آرم", "پژو 405", "عدد", 10, 896000, 985600],
      ["0050102699", "استارت", "پژو 206", "عدد", 1, 0, 0],
      ["0060100299", "استکان", "پژو پارس", "عدد", 8, "", ""],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.prices.get("0010201299")).toBe(840_000);
    expect(res.prices.get("0030100599")).toBe(89_600);
    expect(res.prices.get("0050102699")).toBeNull();
    expect(res.prices.get("0060100299")).toBeNull();
    expect(res.fileRows).toBe(4);
  });
  it("works with the columns in another order, and counts bad rows", () => {
    const res = parseIsacoSheet([["قیمت خرده فروشی", "کد تدارکاتی"], [1000, "11"], ["abc", "22"], [1000, "کد بد"]]);
    expect(res.ok && res.prices.get("11")).toBe(100);
    expect(res.ok && res.badRows).toBe(2);
  });
  it("says which column is missing", () => {
    expect(parseIsacoSheet([["کد تدارکاتی", "قیمت عمده"]]).ok).toBe(false);
  });
});

describe("planIsacoPrices (#8)", () => {
  const W = "isaco";
  const g = (code: string, old: number | null, warehouseId = W) => ({ id: `id-${code}`, code, name: code, warehouseId, purchasePriceToman: old });
  it("changes only the goods of the ISACO warehouse", () => {
    const p = planIsacoPrices(W, [g("1", 100), g("2", 100, "other")], new Map([["1", 110], ["2", 500]]));
    expect(p.apply.map((c) => c.code)).toEqual(["1"]);
  });
  it("keeps the price of goods missing from the file or with price 0", () => {
    const p = planIsacoPrices(W, [g("1", 100), g("2", 100)], new Map([["2", null]]));
    expect(p.apply).toEqual([]);
    expect(p.missing).toBe(1);
    expect(p.noPrice).toBe(1);
  });
  it("an equal price is unchanged", () => {
    expect(planIsacoPrices(W, [g("1", 100)], new Map([["1", 100]])).unchanged).toBe(1);
  });
  it("the shop price is the new purchase price + the warehouse profit (100 → 110 with 10%)", () => {
    const p = planIsacoPrices(W, [g("1", 90_000)], new Map([["1", 100_000]]));
    expect(shopPriceToman(p.apply[0].newToman, 1000)).toBe(110_000);
  });
  it("more than 50 big jumps wait for «تأیید» and the rest apply; 50 all apply", () => {
    const goods = Array.from({ length: 60 }, (_, i) => g(String(i), 1000));
    const prices = (jumps: number) => new Map(goods.map((x, i): [string, number] => [x.code, i < jumps ? 2000 : 1100]));
    const many = planIsacoPrices(W, goods, prices(51));
    expect(many.waiting).toHaveLength(51);
    expect(many.apply).toHaveLength(9);
    const fifty = planIsacoPrices(W, goods, prices(50));
    expect(fifty.waiting).toEqual([]);
    expect(fifty.apply).toHaveLength(60);
  });
  it("more than 30% is a big jump; no old price never is", () => {
    expect(isBigJump(1000, 1300)).toBe(false);
    expect(isBigJump(1000, 1301)).toBe(true);
    expect(isBigJump(1000, 699)).toBe(true);
    expect(isBigJump(null, 5000)).toBe(false);
    expect(isBigJump(0, 5000)).toBe(false);
  });
});

describe("sheetModeFor", () => {
  it("the ISACO warehouse's stock sheet changes only stock; others stock and price", () => {
    expect(sheetModeFor("a", "a")).toBe("stock_only");
    expect(sheetModeFor("b", "a")).toBe("stock_and_price");
    expect(sheetModeFor("b", null)).toBe("stock_and_price");
  });
});

describe("waitingToApply", () => {
  const w = (productId: string, oldToman: number | null) => ({ productId, oldToman, newToman: 999 });
  const goods = new Map([
    ["a", { warehouseId: "isaco", purchasePriceToman: 100 }],
    ["b", { warehouseId: "isaco", purchasePriceToman: 150 }],
    ["c", { warehouseId: "other", purchasePriceToman: 100 }],
  ]);
  it("applies only goods still in the ISACO warehouse with the same old price", () => {
    expect(waitingToApply([w("a", 100), w("b", 100), w("c", 100), w("gone", 100)], goods, "isaco").map((x) => x.productId)).toEqual(["a"]);
  });
  it("applies nothing when there is no ISACO warehouse", () => {
    expect(waitingToApply([w("a", 100)], goods, null)).toEqual([]);
  });
});

describe("fixLamAlef (#3)", () => {
  it("fixes the «لا» that رفیع نیا's PDFs store as «ال», and keeps a real «ال»", () => {
    expect(fixLamAlef("نام کاال")).toBe("نام کالا");
    expect(fixLamAlef("الستیکی")).toBe("لاستیکی");
    expect(fixLamAlef("محصوالت")).toBe("محصولات");
    expect(fixLamAlef("طبق کامل ال 90")).toBe("طبق کامل ال 90");
  });
});

describe("parsePriceListLines (#3)", () => {
  // Pieces as رفیع نیا's PDF gives them: x from the left, Persian read right to left.
  const header = { items: [{ x: 512, s: "ردیف" }, { x: 387, s: "نام کاال" }, { x: 245, s: "تعداد در کارتن" }, { x: 200, s: "واحد" }, { x: 109, s: "فی بریال" }] };
  const title = { items: [{ x: 498, s: "لیست" }, { x: 469, s: "قیمت" }, { x: 380, s: "محصوالت" }], pageStart: true };
  const car = (s: string) => ({ items: [{ x: 290, s }] });
  const good = (n: string, name: string[], qty: string, unit: string, price: string) => ({
    items: [{ x: 510, s: n }, ...name.map((s, i) => ({ x: 450 - i * 20, s })), { x: 264, s: qty }, { x: 203, s: unit }, { x: 108, s: price }],
  });
  const lines = [
    title,
    header,
    car("پژو 405"),
    good("1", ["سیبک طبق پژو", "405"], "60", "عدد", "3,900,000"),
    good("2", ["سیبک فرمان پژو", "405", "(", "راست", ")"], "30", "عدد", "4,900,000"),
    car("پراید"),
    good("3", ["نرو ماده"], "10", "جفت", "750,000"),
    { items: [{ x: 412, s: "طبق کامل رنو ساندرو چپ" }, { x: 267, s: "6" }, { x: 203, s: "عدد" }, { x: 105, s: "25,000,000" }] },
    { ...header, pageStart: true },
    car("سمند"),
    good("4", ["لنت ترمز سمند"], "20", "دست", "12,360,000"),
  ];
  const res = parsePriceListLines(lines);
  it("reads goods with their car, unit and price; the title above the header is skipped", () => {
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toEqual([
      { name: "سیبک طبق پژو 405", car: "پژو 405", unit: "piece", priceRial: 3_900_000 },
      { name: "سیبک فرمان پژو 405 (راست)", car: "پژو 405", unit: "piece", priceRial: 4_900_000 },
      { name: "نرو ماده", car: "پراید", unit: "pair", priceRial: 750_000 },
      { name: "طبق کامل رنو ساندرو چپ", car: "پراید", unit: "piece", priceRial: 25_000_000 },
      { name: "لنت ترمز سمند", car: "سمند", unit: "piece", priceRial: 12_360_000 },
    ]);
  });
  it("goods at the top of a page, before that page's header, are read under the car so far", () => {
    const res = parsePriceListLines([
      header,
      car("پراید"),
      good("87", ["کاسه چرخ عقب پراید"], "4", "عدد", "14,510,000"),
      { ...good("88", ["لنت ترمز پراید"], "24", "دست", "8,778,000"), pageStart: true },
      header,
      car("ریو - تیبا"),
      good("91", ["طبق ریو"], "4", "عدد", "13,800,000"),
    ]);
    expect(res.ok && res.rows.map((r) => [r.car, r.name])).toEqual([
      ["پراید", "کاسه چرخ عقب پراید"],
      ["پراید", "لنت ترمز پراید"],
      ["ریو - تیبا", "طبق ریو"],
    ]);
  });
  it("a name that wraps onto its own line (name column, no price, no row number) joins the good above", () => {
    const res = parsePriceListLines([
      header,
      car("پراید"),
      good("78", ["جعبه فرمان پراید مکانیکی"], "4", "عدد", "55,100,000"),
      { items: [{ x: 430, s: "بدون سیبک و قرقری" }] },
      car("ریو - تیبا"),
      good("79", ["طبق ریو"], "4", "عدد", "13,800,000"),
    ]);
    expect(res.ok && res.rows.map((r) => [r.car, r.name])).toEqual([
      ["پراید", "جعبه فرمان پراید مکانیکی بدون سیبک و قرقری"],
      ["ریو - تیبا", "طبق ریو"],
    ]);
  });
  it("a PDF with no goods (e.g. a scanned one) is an error", () => {
    expect(parsePriceListLines([title]).ok).toBe(false);
  });
});

describe("pdfListToStockRows (#3)", () => {
  const hash = (t: string) => Array.from(t).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(9, "0");
  const row = (name: string, car: string | null, priceRial = 3_900_000) => ({ name, car, unit: "piece" as const, priceRial });
  it("Rial → Toman, a code made from warehouse + name + car, the same every month", () => {
    const a = pdfListToStockRows("w1", [row("سیبک طبق پژو 405", "پژو 405")], hash);
    const b = pdfListToStockRows("w1", [row("سیبک  طبق پژو ۴۰۵", "پژو 405", 4_000_000)], hash);
    expect(a.rows[0].purchaseToman).toBe(390_000);
    expect(a.rows[0].code).toMatch(/^L[0-9A-F]{9}$/);
    expect(b.rows[0].code).toBe(a.rows[0].code);
  });
  it("another car or another warehouse is another good", () => {
    const one = pdfListToStockRows("w1", [row("لنت ترمز", "پژو 405"), row("لنت ترمز", "پراید")], hash);
    expect(one.rows[0].code).not.toBe(one.rows[1].code);
    expect(pdfListToStockRows("w2", [row("لنت ترمز", "پژو 405")], hash).rows[0].code).not.toBe(one.rows[0].code);
  });
  it("the same good twice in one list is reported, not created twice", () => {
    const res = pdfListToStockRows("w1", [row("لنت ترمز", "پراید"), row("لنت ترمز", "پراید")], hash);
    expect(res.rows).toHaveLength(1);
    expect(res.errors).toHaveLength(1);
  });
  it("shop price of 390,000 with 5% profit is 409,000 (rounded down to 1,000)", () => {
    expect(shopPriceToman(390_000, 500)).toBe(409_000);
  });
});

describe("price-list codes and brand (#3)", () => {
  const cars = new Map<string, string | null>([["پراید", "PR"], ["پژو 405", "P405"], ["سمند", null]]);
  it("RF.PR.001 onward per warehouse and car, after the codes already used", () => {
    const res = makeListCodes(
      [{ key: "a", car: "پراید" }, { key: "b", car: "پراید" }, { key: "c", car: "پژو 405" }, { key: "d", car: null }],
      "RF",
      cars,
      ["RF.PR.007", "RF.P405.abc", "ZZ.PR.050"],
    );
    expect(Object.fromEntries(res.codes)).toEqual({ a: "RF.PR.008", b: "RF.PR.009", c: "RF.P405.001", d: "RF.GEN.001" });
    expect(res.missingCars).toEqual([]);
  });
  it("lists the cars that have no English code yet", () => {
    const res = makeListCodes([{ key: "a", car: "سمند" }, { key: "b", car: "سمند" }, { key: "c", car: "پیکان" }], "RF", cars, []);
    expect(res.missingCars).toEqual(["سمند", "پیکان"]);
    expect(res.codes.size).toBe(0);
  });
  it("the warehouse name goes at the end of the name, once", () => {
    expect(withBrand("سیبک طبق پژو 405", "رفیع نیا")).toBe("سیبک طبق پژو 405 - رفیع نیا");
    expect(withBrand("سیبک طبق پژو 405 - رفیع نیا", "رفیع نیا")).toBe("سیبک طبق پژو 405 - رفیع نیا");
  });
});

describe("shopName", () => {
  it("shows the technical code at the end of the name, once", () => {
    expect(shopName("سیبک طبق پژو 405 - رفیع نیا", "RF.P405.001")).toBe("سیبک طبق پژو 405 - رفیع نیا RF.P405.001");
    expect(shopName("رله فن 0750401199", "0750401199")).toBe("رله فن 0750401199");
  });
});
