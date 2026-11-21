import { Suspense } from "react";
import { EditProduct } from "@/modules/catalog";

export default function EditProductPage(props: PageProps<"/admin/catalog/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">ویرایش کالا</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <EditProduct params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
