import Link from "next/link";
import { formatToman, unitPriceLabel, type Unit } from "../rules";
import type { ProductAction } from "./shop";
import type { ShopProduct } from "../service";
import { Photo } from "./photo";

/** The shop price, with «قیمت یک عدد / یک جفت» in small type under it. */
export function PriceText({ toman, unit }: { toman: number | null; unit?: Unit }) {
  if (toman === null) return <span className="text-muted-foreground">برای قیمت تماس بگیرید</span>;
  return (
    <span className="flex flex-col">
      <span className="font-bold">{formatToman(toman)}</span>
      {unit && <span className="text-muted-foreground text-[0.7rem] font-normal">{unitPriceLabel(unit)}</span>}
    </span>
  );
}

export function UnavailableBadge() {
  return (
    <span className="bg-destructive/10 text-destructive rounded-md px-2 py-0.5 text-xs font-medium">
      ناموجود
    </span>
  );
}

/**
 * One product in a list: what a shopper may see. Never the purchase price, warehouse or stock.
 * `action` (the cart's quick add) shows on hover; on phones (no hover) it is always shown.
 */
export function ProductCard({ product, action }: { product: ShopProduct; action?: ProductAction }) {
  return (
    <div className="group hover:border-primary relative flex flex-col rounded-xl border transition-colors">
    <Link href={`/p/${encodeURIComponent(product.code)}`} className="flex flex-1 flex-col gap-2 p-3">
      <div className="bg-muted/40 flex aspect-square items-center justify-center overflow-hidden rounded-lg">
        {product.photo ? (
          <Photo fileName={product.photo} alt={product.name} size={240} className="size-full object-contain" />
        ) : (
          <span className="text-muted-foreground text-xs">بدون عکس</span>
        )}
      </div>
      <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
      <p className="text-muted-foreground text-xs">
        {[product.brandName, product.countryName].filter(Boolean).join(" · ") || " "}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 text-sm">
        <PriceText toman={product.shopPriceToman} unit={product.unit} />
        {product.isUnavailable && <UnavailableBadge />}
      </div>
    </Link>
      {action && !product.isUnavailable && (
        <div className="bg-background/95 border-t p-2 transition-opacity md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100">
          {action({ id: product.id, unit: product.unit, isUnavailable: product.isUnavailable })}
        </div>
      )}
    </div>
  );
}

export function ProductGrid({ products, action }: { products: ShopProduct[]; action?: ProductAction }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} action={action} />
      ))}
    </div>
  );
}
