// Public surface of the catalog module. Code outside this folder imports ONLY from here:
//   import { ShopSearch } from "@/modules/catalog";
// Server-only: never import this file from a client component.

// Shop
export { ProductDetails, ShopSearch } from "./ui/shop";
// Admin
export { EditProduct, NewProduct, ProductAdminTable } from "./ui/admin-products";
export { CatalogLists } from "./ui/lists-page";
export { StockSheetImport } from "./ui/import-page";
// Media route (/media/<file>) and the cart later (#5)
export { readPhoto } from "./service";
export { canAddToCart } from "./rules";
export type { Product } from "./schema";
