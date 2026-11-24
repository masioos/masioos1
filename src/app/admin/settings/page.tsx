import { Suspense } from "react";
import { SettingsEditor } from "@/modules/settings";
import { ManagerOnly } from "@/modules/staff";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">تنظیمات</h1>
      <Suspense fallback={<p>در حال بارگذاری…</p>}>
        <ManagerOnly>
          <SettingsEditor />
        </ManagerOnly>
      </Suspense>
    </main>
  );
}
