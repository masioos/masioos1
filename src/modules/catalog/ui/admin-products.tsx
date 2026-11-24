import Link from "next/link";
import { notFound } from "next/navigation";
import { groupFa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canSee, requireStaff } from "@/modules/staff";
import { formatToman, isUuid } from "../rules";
import {
  getProductForEdit,
  listProductFormOptions,
  listProductsAdmin,
  PAGE_SIZE,
} from "../service";
import { FlagButton } from "./flag-button";
import { selectClass } from "./options";
import { Pager } from "./pager";
import { PhotoManager } from "./photo-manager";
import { ProductForm } from "./product-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pageOf = (v: string | string[] | undefined) => Math.max(1, Math.min(1000, Number(one(v)) || 1));

const price = (n: number | null) => (n === null ? "—" : formatToman(n));

/** Admin product list: search, warehouse filter, purchase + shop price, quick switches. */
export async function ProductAdminTable({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireStaff();
  // Sellers: no edit links or switches; purchase price only when the manager allowed it.
  const manager = viewer.role === "manager";
  const showPurchase = canSee(viewer, "purchasePrice");
  const sp = await searchParams;
  const q = one(sp.q);
  const warehouseId = isUuid(one(sp.warehouse)) ? one(sp.warehouse) : "";
  const page = pageOf(sp.page);
  const [{ items, total }, { warehouses }] = await Promise.all([
    listProductsAdmin({ q, warehouseId: warehouseId || undefined, page }),
    listProductFormOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-end gap-2" action="/admin/catalog">
        <Input name="q" defaultValue={q} placeholder="نام، کد فنی یا برند" className="w-64" />
        <select name="warehouse" defaultValue={warehouseId} className={`${selectClass} w-48`} aria-label="انبار">
          <option value="">همه‌ی انبارها</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          جست‌وجو
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">{groupFa(total)} کالا</p>
      {items.length === 0 ? (
        <p>کالایی پیدا نشد.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کد فنی</TableHead>
              <TableHead>نام</TableHead>
              <TableHead>برند</TableHead>
              <TableHead>انبار</TableHead>
              {showPurchase && <TableHead>قیمت خرید</TableHead>}
              <TableHead>قیمت سایت</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>موجودی</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell dir="ltr" className="text-end">
                  {p.code}
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal">
                  {manager ? (
                    <Link className="text-primary underline" href={`/admin/catalog/${p.id}`}>
                      {p.name}
                    </Link>
                  ) : (
                    p.name
                  )}
                </TableCell>
                <TableCell>{p.brandName ?? "—"}</TableCell>
                <TableCell>{p.warehouseName}</TableCell>
                {showPurchase && <TableCell>{price(p.purchasePriceToman)}</TableCell>}
                <TableCell>{price(p.shopPriceToman)}</TableCell>
                <TableCell>
                  {manager ? <FlagButton id={p.id} flag="isActive" value={p.isActive} /> : p.isActive ? "فعال" : "غیرفعال"}
                </TableCell>
                <TableCell>
                  {manager ? (
                    <FlagButton id={p.id} flag="isUnavailable" value={p.isUnavailable} />
                  ) : p.isUnavailable ? (
                    "ناموجود"
                  ) : (
                    "موجود"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager
        basePath="/admin/catalog"
        params={{ q, warehouse: warehouseId }}
        page={page}
        pages={Math.ceil(total / PAGE_SIZE)}
      />
    </div>
  );
}

export async function NewProduct() {
  const options = await listProductFormOptions();
  if (options.warehouses.length === 0) {
    return (
      <p>
        اول یک انبار بسازید:{" "}
        <Link className="text-primary underline" href="/admin/warehouses">
          انبارها
        </Link>
      </p>
    );
  }
  return <ProductForm options={options} />;
}

export async function EditProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const [data, options] = await Promise.all([getProductForEdit(id), listProductFormOptions()]);
  if (!data) notFound();
  const { product, carIds, photos } = data;

  return (
    <div className="flex flex-col gap-6">
      {one(sp.saved) && <p className="text-sm text-green-700">کالا ثبت شد. حالا می‌توانید عکس اضافه کنید.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <FlagButton id={product.id} flag="isActive" value={product.isActive} />
        <FlagButton id={product.id} flag="isUnavailable" value={product.isUnavailable} />
        {product.isActive && (
          <Link className="text-primary text-sm underline" href={`/p/${encodeURIComponent(product.code)}`}>
            دیدن در فروشگاه
          </Link>
        )}
      </div>
      <ProductForm options={options} product={{ ...product, carIds }} />
      <PhotoManager productId={product.id} photos={photos} />
    </div>
  );
}
