import { Suspense } from "react";
import { CatalogLists } from "@/modules/catalog";

export default function CatalogListsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">فهرست‌ها</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <CatalogLists />
      </Suspense>
    </main>
  );
}
