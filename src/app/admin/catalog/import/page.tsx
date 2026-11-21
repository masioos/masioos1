import { Suspense } from "react";
import { StockSheetImport } from "@/modules/catalog";

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">ورود کالا از فایل Excel</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <StockSheetImport />
      </Suspense>
    </main>
  );
}
