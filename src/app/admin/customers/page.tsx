import { Suspense } from "react";
import { CustomersTable } from "@/modules/customers";

export default function CustomersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">مشتری‌ها</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <CustomersTable />
      </Suspense>
    </main>
  );
}
