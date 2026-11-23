import Link from "next/link";
import { Suspense } from "react";
import { StaffRequest } from "@/modules/requests";

export default function AdminRequestPage(props: PageProps<"/admin/requests/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <Link href="/admin/requests" className="text-primary text-sm underline">
        همه‌ی درخواست‌ها
      </Link>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <StaffRequest params={props.params} />
      </Suspense>
    </main>
  );
}
