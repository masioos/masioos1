import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { groupFa } from "@/lib/money";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";
import Link from "next/link";
import { DEFAULT_SHOP_PAGE_SIZE, isUuid, normalizeCode, shopPageSize, type Unit } from "../rules";
import {
  getProductByCode,
  listFilterOptions,
  listOtherModels,
  searchProducts,
} from "../service";
import { categoryOptions, selectClass } from "./options";
import { PageSizeSelect } from "./page-size-select";
import { Pager } from "./pager";
import { Photo } from "./photo";
import { PriceText, ProductGrid, UnavailableBadge } from "./product-card";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const uuidOrEmpty = (v: string | string[] | undefined) => {
  const s = one(v);
  return isUuid(s) ? s : "";
};

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { id: string; label: string }[];
}) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className={`${selectClass} sm:w-44`}>
      <option value="">{label}: همه</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const named = (list: { id: string; name: string }[]) => list.map((o) => ({ id: o.id, label: o.name }));

/** Shop home: one search box (name / code / brand) + car, category, brand and country filters. */
export async function ShopSearch({ searchParams, action }: { searchParams: SearchParams; action?: ProductAction }) {
  const sp = await searchParams;
  const s = {
    q: one(sp.q).slice(0, 100),
    carId: uuidOrEmpty(sp.car),
    categoryId: uuidOrEmpty(sp.category),
    brandId: uuidOrEmpty(sp.brand),
    countryId: uuidOrEmpty(sp.country),
    page: Math.max(1, Math.min(1000, Number(one(sp.page)) || 1)),
    pageSize: shopPageSize(one(sp.size)),
  };
  const [options, { items, total }] = await Promise.all([listFilterOptions(), searchProducts(s)]);
  const params = { q: s.q, car: s.carId, category: s.categoryId, brand: s.brandId, country: s.countryId };
  const filtered = Object.values(params).some(Boolean);
  // The page size is kept in every link, but only when it is not the default.
  const pagerParams = { ...params, size: s.pageSize === DEFAULT_SHOP_PAGE_SIZE ? "" : String(s.pageSize) };

  return (
    <div className="flex flex-col gap-5">
      <form action="/" className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            name="q"
            type="search"
            defaultValue={s.q}
            placeholder="جست‌وجو: نام قطعه، کد فنی یا برند"
            className="h-10 flex-1 text-base"
          />
          <Button type="submit" className="h-10 px-5">
            جست‌وجو
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <FilterSelect name="car" label="خودرو" value={s.carId} options={named(options.cars)} />
          <FilterSelect
            name="category"
            label="دسته"
            value={s.categoryId}
            options={categoryOptions(options.categories)}
          />
          <FilterSelect name="brand" label="برند" value={s.brandId} options={named(options.brands)} />
          <FilterSelect name="country" label="کشور سازنده" value={s.countryId} options={named(options.countries)} />
          {filtered && (
            <Link href="/" className="text-primary self-center text-sm underline">
              پاک کردن جست‌وجو
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">{groupFa(total)} کالا</p>
          <PageSizeSelect value={s.pageSize} />
        </div>
      </form>

      {items.length === 0 ? <p>کالایی با این مشخصات پیدا نشد.</p> : <ProductGrid products={items} action={action} />}
      <Pager basePath="/" params={pagerParams} page={s.page} pages={Math.ceil(total / s.pageSize)} />
    </div>
  );
}

/** What another module (the cart) needs to place its button on the product page. */
export type ProductAction = (p: { id: string; unit: Unit; isUnavailable: boolean }) => ReactNode;

/**
 * The product page. Inactive or unknown code → 404.
 * `action` lets the page place the add-to-cart button without catalog importing the cart module.
 */
export async function ProductDetails({
  params,
  action,
}: {
  params: Promise<{ code: string }>;
  action?: ProductAction;
}) {
  const { code } = await params;
  const product = await getProductByCode(normalizeCode(code));
  if (!product) notFound();
  const others = await listOtherModels(product.id, product.partGroupId);

  const fields: [string, string | null][] = [
    ["برند", product.brandName],
    ["کد فنی", product.code],
    ["کشور سازنده", product.countryName],
    ["دسته", product.categoryName],
  ];

  return (
    <div className="flex flex-col gap-8">
      <article className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          {product.photos.length === 0 ? (
            <div className="bg-muted/40 text-muted-foreground flex aspect-square items-center justify-center rounded-xl">
              بدون عکس
            </div>
          ) : (
            <>
              <Photo fileName={product.photos[0]} alt={product.name} size={600} className="w-full rounded-xl border object-contain" />
              {product.photos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {product.photos.slice(1).map((f, i) => (
                    <Photo key={f} fileName={f} alt={`${product.name} - ${i + 2}`} size={96} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-3 text-lg">
            <PriceText toman={product.shopPriceToman} unit={product.unit} />
            {product.isUnavailable && <UnavailableBadge />}
          </div>
          {action?.({ id: product.id, unit: product.unit, isUnavailable: product.isUnavailable })}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {fields
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-start">{k === "کد فنی" ? <span dir="ltr" className="inline-block">{v}</span> : v}</dd>
                </div>
              ))}
          </dl>
          {product.cars.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-medium">خودروهای سازگار</h2>
              <ul className="flex flex-wrap gap-2">
                {product.cars.map((c) => (
                  <li key={c} className="bg-muted rounded-md px-2 py-1 text-sm">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {product.description && <p className="text-sm leading-7 whitespace-pre-line">{product.description}</p>}
        </div>
      </article>

      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">مدل‌های دیگر این قطعه</h2>
          <ProductGrid products={others} />
        </section>
      )}
    </div>
  );
}
