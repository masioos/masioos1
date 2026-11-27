"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { groupFa } from "@/lib/money";
import { approveIsacoAction, chooseIsacoWarehouseAction } from "../actions";
import type { IsacoReport } from "../service";
import { PriceList, Summary } from "./import-form";

// «قیمت ایساکو» (#8): pick the ISACO warehouse, upload ISACO's file, approve big jumps.

/** Makes this warehouse the ISACO warehouse: its prices then come from ISACO's price file. */
export function MakeIsacoButton({ warehouseId, replaces }: { warehouseId: string; replaces: boolean }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const go = () => {
    const fd = new FormData();
    fd.set("warehouseId", warehouseId);
    start(async () => {
      const res = await chooseIsacoWarehouseAction(fd);
      if (res.error) setError(res.error);
    });
  };
  return (
    <div className="flex flex-col gap-2">
      {!sure ? (
        <Button type="button" variant="outline" className="w-fit" onClick={() => (replaces ? setSure(true) : go())} disabled={pending}>
          قیمت این انبار از فایل ایساکو بیاید
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2">
          <span>انبار دیگری الان «ایساکو» است. این انبار جایش ایساکو شود؟</span>
          <Button type="button" size="sm" onClick={go} disabled={pending}>
            بله
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSure(false)}>
            نه
          </Button>
        </div>
      )}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

/** Upload of ISACO's full price file (about 17 MB) to /admin/isaco; then the report. */
export function IsacoUploadForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [report, setReport] = useState<IsacoReport>();
  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid max-w-md gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(undefined);
          setReport(undefined);
          setBusy(true);
          try {
            const res = await fetch("/admin/isaco", { method: "POST", body: new FormData(e.currentTarget) });
            if (res.redirected) {
              setError("زمان ورود شما تمام شده است. دوباره وارد شوید؛ قیمت‌ها عوض نشد.");
              return;
            }
            if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
              setError("خطا در سرور؛ قیمت‌ها عوض نشد. دوباره امتحان کنید.");
              return;
            }
            const answer = (await res.json()) as { report?: IsacoReport; error?: string };
            if (answer.report) {
              setReport(answer.report);
              router.refresh();
            } else setError(answer.error ?? "فایل خوانده نشد. دوباره امتحان کنید.");
          } catch {
            setError("ارتباط قطع شد. دوباره امتحان کنید.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="isacoFile" className="font-medium">
          فایل کامل قیمت ایساکو (Excel با پسوند xlsx)
        </label>
        <input id="isacoFile" name="file" type="file" accept=".xlsx" required disabled={disabled || busy} className="text-sm" />
        <p className="text-muted-foreground text-xs">
          ستون‌های لازم: «کد تدارکاتی» و «قیمت خرده فروشی» (ریال). قیمت خرید = قیمت خرده فروشی؛ قیمت فروش سایت = قیمت خرید +
          درصد سود انبار. کالای تازه ساخته نمی‌شود.
        </p>
        <Button type="submit" disabled={disabled || busy} className="w-fit">
          {busy ? "در حال خواندن فایل… (فایل بزرگ است، چند ثانیه صبر کنید)" : "به‌روز کردن قیمت‌ها"}
        </Button>
      </form>
      {error && <p className="text-destructive">{error}</p>}
      {report && <IsacoReportView report={report} />}
    </div>
  );
}

function IsacoReportView({ report: r }: { report: IsacoReport }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-green-300 bg-green-50 p-4">
      <h2 className="text-lg font-bold">✓ قیمت‌ها به‌روز شد</h2>
      <p className="text-sm">
        ردیف‌های فایل: {groupFa(r.fileRows)}
        {r.badRows > 0 && ` — ردیف‌های خراب (کنار گذاشته شد): ${groupFa(r.badRows)}`}
      </p>
      <Summary
        rows={[
          { label: "قیمت عوض شد", n: r.changed.length, tone: "green" },
          { label: "قیمت همان بود", n: r.unchanged, tone: "blue" },
          { label: "در فایل نبود (قیمت قبلی ماند)", n: r.missing, tone: "amber" },
          { label: "قیمت صفر در فایل (قیمت قبلی ماند)", n: r.noPrice, tone: "amber" },
          { label: "تغییر بزرگ، منتظر تأیید", n: r.waiting.length, tone: "red" },
        ]}
      />
      {r.changed.length > 0 && <PriceList title="قیمت عوض شد" rows={r.changed} />}
    </section>
  );
}

/** «تأیید تغییرهای بزرگ»: applies the waiting big jumps of the newest file. */
export function ApproveIsacoForm({ runId }: { runId: string }) {
  const [state, action, pending] = useActionState(approveIsacoAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="runId" value={runId} />
      <Button type="submit" disabled={pending}>
        {pending ? "در حال ذخیره…" : "تأیید تغییرهای بزرگ"}
      </Button>
      {state.error && <span className="text-destructive text-sm">{state.error}</span>}
    </form>
  );
}
