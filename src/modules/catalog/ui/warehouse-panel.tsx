import { listWarehouses, selectedWarehouse } from "@/modules/warehouses";
import { getIsacoWarehouseId } from "@/modules/settings";
import { ImportForm } from "./import-form";
import { MakeIsacoButton } from "./isaco-forms";
import { IsacoPrices } from "./isaco-page";

/**
 * The blue panel of one warehouse, under the warehouses list (opened by its row's button):
 * «به‌روز کردن موجودی» (its stock sheet) on the right, «به‌روز کردن قیمت» on the left.
 * The ISACO warehouse is titled «ایساکو» and takes its prices from ISACO's price file.
 */
export async function WarehousePanel({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const warehouseId = await selectedWarehouse(searchParams);
  if (!warehouseId) return null;
  const [list, isacoId] = await Promise.all([listWarehouses(), getIsacoWarehouseId()]);
  const w = list.find((x) => x.id === warehouseId);
  if (!w) return null;
  const isIsaco = w.id === isacoId;

  return (
    <section id="panel" className="flex scroll-mt-4 flex-col gap-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
      <h2 className="text-xl font-bold">{isIsaco ? "ایساکو" : w.name}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-4">
          <h3 className="text-lg font-bold">به‌روز کردن موجودی</h3>
          <ImportForm key={w.id} warehouses={[{ id: w.id, name: w.name }]} />
        </div>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-white p-4">
          <h3 className="text-lg font-bold">به‌روز کردن قیمت</h3>
          {isIsaco ? (
            <IsacoPrices />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                قیمت این انبار از همان فایل موجودی (سمت راست) یا دستی در «کالاها» عوض می‌شود. فایل قیمت مخصوص این انبار بعداً
                اضافه می‌شود.
              </p>
              <MakeIsacoButton warehouseId={w.id} replaces={isacoId !== null} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
