import { Suspense } from "react";
import { NewProduct } from "@/modules/catalog";
import { ManagerOnly } from "@/modules/staff";

export default function NewProductPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">کالای جدید</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <ManagerOnly>
          <NewProduct />
        </ManagerOnly>
      </Suspense>
    </main>
  );
}
