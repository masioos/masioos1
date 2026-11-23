import { Suspense } from "react";
import { MyRequests } from "@/modules/requests";

export default function RequestsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">درخواست‌های من</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <MyRequests />
      </Suspense>
    </main>
  );
}
