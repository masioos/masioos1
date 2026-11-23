// Public surface of the catalog module. Code outside this folder imports ONLY from here:
//   import { ShopSearch } from "@/modules/catalog";
// Server-only: never import this file from a client component.

// Shop
export { ProductDetails, ShopSearch, type ProductAction } from "./ui/shop";
export { PriceText } from "./ui/product-card";
// Admin
export { EditProduct, NewProduct, ProductAdminTable } from "./ui/admin-products";
export { CatalogLists } from "./ui/lists-page";
export { StockSheetImport } from "./ui/import-page";
// Media route (/media/<file>), cart and requests (#5)
export { getCartProducts, getProductForStaff, readPhoto, type CartProduct } from "./service";
export { canAddToCart, formatToman, maxQuantity, UNIT_NAMES, unitPriceLabel, type Unit } from "./rules";
export type { Product } from "./schema";
