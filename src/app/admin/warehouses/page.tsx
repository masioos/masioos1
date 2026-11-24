import { Suspense } from "react";
import { ManagerOnly } from "@/modules/staff";
import { CreateWarehouseForm, WarehouseTable } from "@/modules/warehouses";

// Pages stay thin: they place module components and hold no logic.
// Cache Components is on (Next 16): anything that reads the DB goes inside <Suspense>.
export default function WarehousesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold">انبارها</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <ManagerOnly>
          <CreateWarehouseForm />
          <WarehouseTable />
        </ManagerOnly>
      </Suspense>
    </main>
  );
}
