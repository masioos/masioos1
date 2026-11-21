import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isUuid, normalizeCode } from "../rules";
import {
  getProductByCode,
  listFilterOptions,
  listOtherModels,
  PAGE_SIZE,
  searchProducts,
} from "../service";
import { categoryOptions, selectClass } from "./options";
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
export async function ShopSearch({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const s = {
    q: one(sp.q).slice(0, 100),
    carId: uuidOrEmpty(sp.car),
    categoryId: uuidOrEmpty(sp.category),
    brandId: uuidOrEmpty(sp.brand),
    countryId: uuidOrEmpty(sp.country),
    page: Math.max(1, Math.min(1000, Number(one(sp.page)) || 1)),
  };
  const [options, { items, total }] = await Promise.all([listFilterOptions(), searchProducts(s)]);
  const params = { q: s.q, car: s.carId, category: s.categoryId, brand: s.brandId, country: s.countryId };
  const filtered = Object.values(params).some(Boolean);

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
      </form>

      <p className="text-muted-foreground text-sm">{total.toLocaleString("fa-IR")} کالا</p>
      {items.length === 0 ? <p>کالایی با این مشخصات پیدا نشد.</p> : <ProductGrid products={items} />}
      <Pager basePath="/" params={params} page={s.page} pages={Math.ceil(total / PAGE_SIZE)} />
    </div>
  );
}

/** The product page. Inactive or unknown code → 404. */
export async function ProductDetails({ params }: { params: Promise<{ code: string }> }) {
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
            <PriceText toman={product.shopPriceToman} />
            {product.isUnavailable && <UnavailableBadge />}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {fields
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd dir={k === "کد فنی" ? "ltr" : undefined} className="text-start">
                    {v}
                  </dd>
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
