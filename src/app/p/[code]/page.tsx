import Link from "next/link";
import { Suspense } from "react";
import { ProductDetails } from "@/modules/catalog";

// Product page. Stable URL /p/<technical code> (Torob, #7, will link here).
export default function ProductPage(props: PageProps<"/p/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <Link href="/" className="text-primary text-sm underline">
        بازگشت به فروشگاه
      </Link>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <ProductDetails params={props.params} />
      </Suspense>
    </main>
  );
}
