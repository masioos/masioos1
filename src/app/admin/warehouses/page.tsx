import { Suspense } from "react";
import { WarehousePanel } from "@/modules/catalog";
import { ManagerOnly } from "@/modules/staff";
import { CreateWarehouseForm, WarehouseTable } from "@/modules/warehouses";

// Pages stay thin: they place module components and hold no logic.
// Cache Components is on (Next 16): anything that reads the DB goes inside <Suspense>.
// Everything about warehouses is on this one page (Alireza: no extra menu items): the list
// (edited in place), the selected warehouse's panel (stock and prices; ISACO too), a new warehouse.
export default function WarehousesPage({ searchParams }: PageProps<"/admin/warehouses">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold">انبارها</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <ManagerOnly>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">لیست انبارها</h2>
            <WarehouseTable searchParams={searchParams} />
          </section>
          <WarehousePanel searchParams={searchParams} />
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">انبار تازه</h2>
            <CreateWarehouseForm />
          </section>
        </ManagerOnly>
      </Suspense>
    </main>
  );
}
