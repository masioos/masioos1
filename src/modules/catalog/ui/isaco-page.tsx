import { faDateTime } from "@/lib/date";
import { groupFa } from "@/lib/money";
import { BIG_JUMP_PERCENT, MAX_JUMPS_WITHOUT_APPROVAL } from "../rules";
import { isacoWaiting, isacoWarehouseChoice, lastIsacoRun } from "../service";
import { PriceList, Summary } from "./import-form";
import { ApproveIsacoForm, IsacoUploadForm } from "./isaco-forms";

/** «به‌روز کردن قیمت» of the ISACO warehouse (#8): the last upload, big jumps waiting, a new upload. */
export async function IsacoPrices() {
  const [choice, run] = await Promise.all([isacoWarehouseChoice(), lastIsacoRun()]);
  const waiting = run && run.waiting > 0 && !run.approvedAt ? await isacoWaiting(run.id) : [];

  return (
    <div className="flex flex-col gap-6">

      {run && (
        <section className="flex flex-col gap-3 rounded-xl border bg-white p-4">
          <h2 className="text-lg font-bold">آخرین به‌روزرسانی قیمت</h2>
          <p className="text-sm">
            {faDateTime(run.at)}
            {run.staffName && ` — ${run.staffName}`} — ردیف‌های فایل: {groupFa(run.fileRows)}
          </p>
          <Summary
            rows={[
              { label: "قیمت عوض شد", n: run.changed, tone: "green" },
              { label: "قیمت همان بود", n: run.unchanged, tone: "blue" },
              { label: "در فایل نبود (قیمت قبلی ماند)", n: run.missing, tone: "amber" },
              { label: "قیمت صفر در فایل (قیمت قبلی ماند)", n: run.noPrice, tone: "amber" },
              { label: run.approvedAt ? "تغییر بزرگ، تأیید شد" : "تغییر بزرگ، منتظر تأیید", n: run.waiting, tone: "red" },
            ]}
          />
        </section>
      )}

      {run && waiting.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-red-300 bg-red-50 p-4">
          <h2 className="text-lg font-bold text-red-800">تغییرهای بزرگ منتظر تأیید شما</h2>
          <p className="text-sm">
            قیمت {groupFa(waiting.length)} کالا بیشتر از {groupFa(BIG_JUMP_PERCENT)}٪ عوض شده است (بیشتر از{" "}
            {groupFa(MAX_JUMPS_WITHOUT_APPROVAL)} کالا). این قیمت‌ها هنوز عوض نشده‌اند؛ اگر فایل درست است، تأیید کنید.
          </p>
          <PriceList title="تغییرهای بزرگ" rows={waiting} />
          <ApproveIsacoForm runId={run.id} />
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold">فایل قیمت ایساکو</h2>
        <IsacoUploadForm disabled={!choice.current} />
      </section>
    </div>
  );
}
