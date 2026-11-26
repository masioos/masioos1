import { Suspense } from "react";
import { ShopSearch } from "@/modules/catalog";
import { AddToCartButton } from "@/modules/requests";

// Shop home: search + filters + results. The DB part streams inside <Suspense>.
export default function HomePage(props: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">انبارنت</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <ShopSearch
          searchParams={props.searchParams}
          action={(p) => <AddToCartButton productId={p.id} unit={p.unit} isUnavailable={p.isUnavailable} compact />}
        />
      </Suspense>
    </main>
  );
}
