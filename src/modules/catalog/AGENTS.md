# Module: catalog

Owns the goods (products) of every warehouse and the lists that describe them: cars, brands,
countries of origin, categories (two levels) and part groups. Issue #1.

| File               | What                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `index.ts`         | public surface (server-only)                                                  |
| `schema.ts`        | `catalog_*` tables                                                            |
| `rules.ts`         | shop price, Rial→Toman, search text, stock-sheet parser, form schemas + tests |
| `service.ts`       | lists, products, photos, Excel import, shop and admin reads                   |
| `actions.ts`       | server actions for the admin forms                                            |
| `ui/`              | admin (`admin-products`, `list-manager`, `import-form`, `photo-manager`) and shop (`shop`, `product-card`) |

## Rules (from the brief)

- A product belongs to exactly one warehouse. Its technical code is unique (normalized: ASCII digits,
  no spaces or dashes).
- Shop price = purchase price × (1 + warehouse profit), rounded **down** to 1,000 Toman
  (`shopPriceToman`). Profit comes from `@/modules/warehouses` (`getWarehouseProfits`), in basis
  points. Computed on read, so a profit change shows at once. Moves to `pricing` with #8.
- Shop reads (`searchProducts`, `getProductByCode`, `listOtherModels`) return active products only
  and never the purchase price, profit, warehouse or stock.
- No purchase price → «برای قیمت تماس بگیرید». Unavailable → «ناموجود», `canAddToCart` is false.
- Excel import (#2), in steps: `previewStockSheetAction` reads the sheet, keeps it in
  `UPLOAD_DIR/imports` (removed after a day) and shows what changes; `applyStockSheetAction` reads the
  kept file again (rows never come from the browser) and writes it. `rules.planStockImport` decides:
  - new code → listed; created only when ticked (`newCode`), with the sheet price, or without price
    when the warehouse is «فقط موجودی» (`warehouses.sheet_mode = stock_only`, never touches a price);
  - same code in the same warehouse → `from_sheet` true, purchase price (only «موجودی و قیمت»), car
    link; available again if a sheet had made it «ناموجود» (`unavailable_source = sheet`);
  - a `from_sheet` good of this warehouse missing from the sheet → «ناموجود» (`sheet`); goods made
    unavailable by hand (`hand`, set by `setProductFlag`) or never in a sheet are left alone;
  - more than half of the warehouse's sheet goods going «ناموجود» → «مطمئنم» needed;
  - code in another warehouse → skipped and reported. Names are never changed; nothing is deleted.
- `search_text` = `normalizeSearch(name + code + brand)`, written on every save and on brand rename.
  Search splits the query into words; each must be in `search_text` (ILIKE).

## Photos

Files live in `UPLOAD_DIR` (`./uploads` in dev, the `uploads` volume in production — back it up).
Names are `<uuid>.<jpg|png|webp>`; the type comes from the file bytes. Max 5 MB, 6 per product.
Served by `src/app/media/[file]/route.ts` through `readPhoto`.

## PDF price lists (#3)

- The panel's «به‌روز کردن موجودی» takes an Excel stock sheet **or** a readable PDF price list (≤ 10 MB).
  `pdf-list.ts` reads its text with `unpdf` (pdf.js) line by line; `rules.parsePriceListLines` takes
  «نام کالا» · «واحد» · «فی ریال» under the header of each page and car headings between goods
  (shape of رفیع نیا's lists). `fixLamAlef` fixes the «لا» those PDFs store as «ال» (known words only).
- No technical code in such lists: each row gets `list_key` (normalized name | car) and a temporary
  code (`L` + 9 hex of sha256). A good the warehouse already has with that key gives the row its code
  (`resolveListRows`), so the same name + car is the same good every month; a changed name is new.
- New goods get a readable code `RF.P405.001` = warehouse `code_prefix` . car `short_code` . number
  (`makeListCodes`; no car → `GEN`). Missing prefix or car codes → `codeProblem` in the preview,
  «تأیید و ورود» off. The warehouse is the brand and ends the name (`withBrand`, «… - رفیع نیا»).
  Goods made with a temporary code are converted on the next import (`oldListGoods`).
- Then it is the #2 import as is (ticks, «ناموجود», price history `sheet`). Purchase = list price, Rial → Toman.
- The shop shows every name with its technical code at the end (`shopName`).
- Every good that comes from a warehouse file (Excel stock sheet or PDF list) has the warehouse as brand
  and at the end of its name; goods made before that rule get it when a later file has them.
- A PDF with no text (scanned pictures) → «این PDF عکس است…» (#25 will read those).

## ISACO prices (#8)

- One warehouse is the ISACO warehouse (`settings.getIsacoWarehouseId`, chosen with «قیمت این انبار از فایل ایساکو بیاید»
  in a warehouse's panel on «انبارها», `WarehousePanel`; no menu item of its own). Its stock sheet
  then changes only stock (`sheetModeFor`). ISACO's full price file changes the purchase price of that warehouse's
  goods only. Purchase price = «قیمت خرده فروشی» (Rial → Toman); shop price as always.
- The file is ~17 MB (47k rows), above the server-action limit, so it is posted to the route handler
  `src/app/admin/isaco/route.ts` → `uploadIsacoFile` (`isaco-upload.ts`: requireManager, ≤ 30 MB).
- `rules.parseIsacoSheet` reads it; `rules.planIsacoPrices` decides: missing goods and price 0 keep
  their price; no good is created; more than 50 goods moving over 30% → those wait in
  `catalog_isaco_waiting` for «تأیید تغییرهای بزرگ» (`approveIsacoWaiting`, newest run only, skips a
  good whose price changed since). Each upload is a `catalog_isaco_runs` row.
- Price history (`catalog_price_history`): every purchase-price change — by hand (`updateProduct`),
  stock sheet, ISACO — with old / new price, source and staff. Shown on the product edit page.
- The robot (#22) will call `importIsacoPrices` with the downloaded file.

## Not here yet

Price lists per warehouse (#3), ISACO robot (#22), Torob (#7). No delete of products or list items.
