import Link from "next/link";
import { Suspense } from "react";
import { MyRequest } from "@/modules/requests";

export default function RequestPage(props: PageProps<"/requests/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <Link href="/requests" className="text-primary text-sm underline">
        همه‌ی درخواست‌های من
      </Link>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <MyRequest params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
