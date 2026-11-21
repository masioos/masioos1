import Link from "next/link";
import { formatToman } from "../rules";
import type { ShopProduct } from "../service";
import { Photo } from "./photo";

export function PriceText({ toman }: { toman: number | null }) {
  if (toman === null) return <span className="text-muted-foreground">برای قیمت تماس بگیرید</span>;
  return <span className="font-bold">{formatToman(toman)}</span>;
}

export function UnavailableBadge() {
  return (
    <span className="bg-destructive/10 text-destructive rounded-md px-2 py-0.5 text-xs font-medium">
      ناموجود
    </span>
  );
}

/** One product in a list: what a shopper may see. Never the purchase price, warehouse or stock. */
export function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Link
      href={`/p/${product.code}`}
      className="hover:border-primary flex flex-col gap-2 rounded-xl border p-3 transition-colors"
    >
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
        <PriceText toman={product.shopPriceToman} />
        {product.isUnavailable && <UnavailableBadge />}
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ShopProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
