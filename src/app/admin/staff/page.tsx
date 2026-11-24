import { Suspense } from "react";
import { StaffTable } from "@/modules/staff";

export default function StaffPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">فروشنده‌ها</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <StaffTable />
      </Suspense>
    </main>
  );
}
