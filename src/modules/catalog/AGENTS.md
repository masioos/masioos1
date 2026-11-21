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
- Excel import (`importStockSheet`): new code → create; same code in the same warehouse → purchase
  price only (+ car link); code in another warehouse → skipped and reported. Names are never changed.
- `search_text` = `normalizeSearch(name + code + brand)`, written on every save and on brand rename.
  Search splits the query into words; each must be in `search_text` (ILIKE).

## Photos

Files live in `UPLOAD_DIR` (`./uploads` in dev, the `uploads` volume in production — back it up).
Names are `<uuid>.<jpg|png|webp>`; the type comes from the file bytes. Max 5 MB, 6 per product.
Served by `src/app/media/[file]/route.ts` through `readPhoto`.

## Not here yet

Cart (#5), price lists (#3), supplier price feeds (#8), Torob (#7), admin sign-in (#9). No delete of
products or list items.
