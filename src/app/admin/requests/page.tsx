import { Suspense } from "react";
import { RequestsTable } from "@/modules/requests";

export default function AdminRequestsPage(props: PageProps<"/admin/requests">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">درخواست‌ها</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <RequestsTable searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
