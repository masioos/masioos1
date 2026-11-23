import { Suspense } from "react";
import { RegisterPage } from "@/modules/customers";

export default function Page(props: PageProps<"/account/register">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">ساخت حساب</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <RegisterPage searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
