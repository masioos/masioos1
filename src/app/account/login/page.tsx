import { Suspense } from "react";
import { LoginPage } from "@/modules/customers";

export default function Page(props: PageProps<"/account/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">ورود</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <LoginPage searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
