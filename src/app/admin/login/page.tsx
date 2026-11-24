import { Suspense } from "react";
import { StaffLoginPage } from "@/modules/staff";

export default function AdminLoginPage(props: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-6 p-8">
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <StaffLoginPage searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
