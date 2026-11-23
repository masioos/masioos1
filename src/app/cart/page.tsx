import { Suspense } from "react";
import { CartPage } from "@/modules/requests";

export default function Cart() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">سبد خرید</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <CartPage />
      </Suspense>
    </main>
  );
}
