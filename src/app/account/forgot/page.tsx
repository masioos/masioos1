import { Suspense } from "react";
import { ForgotPassword } from "@/modules/customers";
import { SupportPhone } from "@/modules/settings";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">فراموشی رمز</h1>
      <ForgotPassword
        phone={
          <Suspense fallback="…">
            <SupportPhone />
          </Suspense>
        }
      />
    </main>
  );
}
