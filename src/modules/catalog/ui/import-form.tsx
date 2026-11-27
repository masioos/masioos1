"use client";

import { useActionState, useRef, useState } from "react";
import { groupFa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { applyStockSheetAction, previewStockSheetAction, type ImportState } from "../actions";
import { priceMove, type StockRowError } from "../rules";
import { selectClass } from "./options";

const fa = (n: number) => groupFa(n);
const MODE_NAMES = { stock_and_price: "موجودی و قیمت", stock_only: "فقط موجودی" } as const;

/**
 * «ورود از Excel» (#2): 1) pick warehouse and file → 2) see what changes, tick the new goods,
 * «مطمئنم» when more than half would go «ناموجود» → 3) the report.
 */
export function ImportForm({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  const [round, setRound] = useState(0);
  return <ImportSteps key={round} warehouses={warehouses} again={() => setRound((n) => n + 1)} />;
}

function ImportSteps({ warehouses, again }: { warehouses: { id: string; name: string }[]; again: () => void }) {
  const [previewState, previewAction, reading] = useActionState(previewStockSheetAction, {});
  const [applyState, applyAction, applying] = useActionState(applyStockSheetAction, {});

  if (applyState.step === "done") return <Report report={applyState.report} again={again} />;
  if (previewState.step === "preview") {
    const error = applyState.step === undefined ? applyState.error : undefined;
    return <Preview state={previewState} action={applyAction} pending={applying} error={error} again={again} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={previewAction} className="grid max-w-md gap-3">
        <Label htmlFor="warehouseId">انبار</Label>
        <select id="warehouseId" name="warehouseId" required defaultValue="" className={selectClass}>
          <option value="">— انتخاب کنید —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <Label htmlFor="file">فایل موجودی (Excel با پسوند xlsx)</Label>
        <input id="file" name="file" type="file" accept=".xlsx" required className="text-sm" />
        <p className="text-muted-foreground text-xs">
          ستون‌های لازم: «کد فنی قطعه»، «نام قطعه»، «گروه خودرو»، «قیمت فروش (ریال)». قبل از ذخیره، تغییرها و
          کالاهای تازه را می‌بینید. اینکه قیمت‌ها هم عوض شوند یا فقط موجودی، در «انبارها» برای هر انبار تعیین می‌شود.
        </p>
        <Button type="submit" disabled={reading}>
          {reading ? "در حال خواندن فایل… (ممکن است چند ثانیه طول بکشد)" : "خواندن فایل"}
        </Button>
      </form>
      {previewState.step === undefined && previewState.error && <p className="text-destructive">{previewState.error}</p>}
    </div>
  );
}

function Preview({
  state,
  action,
  pending,
  error,
  again,
}: {
  state: Extract<ImportState, { step: "preview" }>;
  action: (fd: FormData) => void;
  pending: boolean;
  error?: string;
  again: () => void;
}) {
  const p = state.preview;
  const formRef = useRef<HTMLFormElement>(null);
  const tickAll = (on: boolean) =>
    formRef.current?.querySelectorAll<HTMLInputElement>('input[name="newCode"]').forEach((b) => {
      b.checked = on;
    });
  const problems = [...state.fileErrors, ...p.skipped];
  const [unsure, setUnsure] = useState(false);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        // «مطمئنم» not ticked: stop here, so the ticks on new goods are kept.
        if (p.needsConfirm && !new FormData(e.currentTarget).has("confirmed")) {
          e.preventDefault();
          setUnsure(true);
        }
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="token" value={state.token} />
      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="text-lg font-bold">
          انبار {p.warehouseName} — فایل اکسل: {MODE_NAMES[p.mode]}
        </h2>
        <Summary
          rows={[
            ...(p.mode === "stock_and_price" ? [{ label: "قیمت عوض می‌شود", n: p.pricesChanged.length, tone: "green" as const }] : []),
            { label: "دوباره موجود می‌شود", n: p.madeAvailable, tone: "blue" },
            { label: "ناموجود می‌شود (در فایل نیست)", n: p.madeUnavailable.length, tone: "red" },
            { label: "کالای تازه در فایل", n: p.newRows.length, tone: "amber" },
          ]}
        />
        {p.madeUnavailable.length > 0 && <GoodsList title="کالاهایی که ناموجود می‌شوند" goods={p.madeUnavailable} />}
        {p.pricesChanged.length > 0 && <PriceList title="قیمت عوض می‌شود" rows={p.pricesChanged} />}
      </section>

      {p.newRows.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="font-bold">کالاهای تازه — کدام‌ها در سایت ساخته شوند؟</h2>
          <p className="text-muted-foreground text-xs">
            {p.mode === "stock_only"
              ? "بدون قیمت ساخته می‌شوند («برای قیمت تماس بگیرید»)."
              : "با قیمت همین فایل ساخته می‌شوند."}
          </p>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => tickAll(true)}>
              همه
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => tickAll(false)}>
              هیچ‌کدام
            </Button>
          </span>
          <ul className="grid max-h-96 gap-1 overflow-auto text-sm">
            {p.newRows.map((r) => (
              <li key={r.code}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="newCode" value={r.code} className="size-4" />
                  <span dir="ltr" className="font-mono">
                    {r.code}
                  </span>
                  <span>{r.name}</span>
                  {r.car && <span className="text-muted-foreground">— {r.car}</span>}
                  {p.mode === "stock_and_price" && r.purchaseToman !== null && (
                    <span className="text-muted-foreground">— {fa(r.purchaseToman)} تومان</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {problems.length > 0 && <Problems problems={problems} />}

      {p.needsConfirm && (
        <label
          className={`flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-900 ${unsure ? "blink-red" : ""}`}
        >
          <input type="checkbox" name="confirmed" className="size-4" onChange={() => setUnsure(false)} />
          بیشتر از نصف کالاهای این انبار ناموجود می‌شوند. مطمئنی فایل درست است؟ مطمئنم
        </label>
      )}
      {error && <p className="text-destructive">{error}</p>}
      <span className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "تأیید و ورود"}
        </Button>
        <Button type="button" variant="outline" onClick={again}>
          انصراف
        </Button>
      </span>
    </form>
  );
}

/** Click to open. Red: goods that go «ناموجود». */
function GoodsList({ title, goods }: { title: string; goods: { code: string; name: string }[] }) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-md bg-red-100 px-2 py-1 font-medium text-red-700">
        {title} ({fa(goods.length)})
      </summary>
      <ul className="mt-1 grid max-h-80 gap-1 overflow-auto">
        {goods.map((g) => (
          <li key={g.code}>
            <span dir="ltr" className="font-mono">
              {g.code}
            </span>{" "}
            {g.name}
          </li>
        ))}
      </ul>
    </details>
  );
}

const signed = (n: number) => (n > 0 ? `+${fa(n)}` : n < 0 ? `−${fa(-n)}` : fa(0));
const toman = (n: number | null) => (n === null ? "بدون قیمت" : fa(n));

/** Click to open. Green: price changes with old and new price, percent and Toman. */
function PriceList({
  title,
  rows,
}: {
  title: string;
  rows: { code: string; name: string; oldToman: number | null; newToman: number | null }[];
}) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-md bg-green-100 px-2 py-1 font-medium text-green-700">
        {title} ({fa(rows.length)})
      </summary>
      <div dir="ltr" className="mt-2 max-h-96 overflow-auto rounded-lg border">
        <table dir="rtl" className="w-full bg-[#fbf7f2] text-sm">
          <thead className="sticky top-0 bg-blue-100">
            <tr className="text-right">
              <th className="p-2">کد فنی</th>
              <th className="p-2">نام</th>
              <th className="p-2">قیمت قبلی</th>
              <th className="p-2">قیمت تازه</th>
              <th className="p-2">درصد</th>
              <th className="p-2">میزان</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = priceMove(r.oldToman, r.newToman);
              const tone = m.amount === null ? "" : m.amount > 0 ? "text-green-700" : m.amount < 0 ? "text-red-700" : "";
              return (
                <tr key={r.code} className="border-t border-[#ece3d6]">
                  <td className="p-2 font-mono" dir="ltr">
                    {r.code}
                  </td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{toman(r.oldToman)}</td>
                  <td className="p-2">{toman(r.newToman)}</td>
                  <td className={`p-2 ${tone}`} dir="ltr">
                    {m.percent === null ? "—" : `${m.percent > 0 ? "+" : m.percent < 0 ? "−" : ""}${groupFa(Math.abs(m.percent))}٪`}
                  </td>
                  <td className={`p-2 ${tone}`} dir="ltr">
                    {m.amount === null ? "—" : signed(m.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const TONES = {
  green: "bg-green-50 text-green-800",
  blue: "bg-blue-50 text-blue-800",
  red: "bg-red-50 text-red-800",
  amber: "bg-amber-50 text-amber-800",
} as const;

/** The totals of an import as a small coloured table: what, and how many goods. */
function Summary({ rows }: { rows: { label: string; n: number; tone: keyof typeof TONES }[] }) {
  return (
    <table className="w-full max-w-md overflow-hidden rounded-lg border text-sm">
      <thead className="bg-blue-100">
        <tr className="text-right">
          <th className="p-2">تغییر</th>
          <th className="p-2 text-center">تعداد کالا</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className={`border-t ${TONES[r.tone]}`}>
            <td className="p-2">{r.label}</td>
            <td className="p-2 text-center text-base font-bold">{fa(r.n)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Problems({ problems }: { problems: StockRowError[] }) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border p-4 text-sm">
      <h2 className="font-bold">ردیف‌های ردشده: {fa(problems.length)}</h2>
      <ul className="grid max-h-80 gap-1 overflow-auto">
        {[...problems]
          .sort((a, b) => a.row - b.row)
          .map((p) => (
            <li key={`${p.row}-${p.code}`}>
              ردیف {fa(p.row)}
              {p.code && (
                <>
                  {" "}
                  (کد <span dir="ltr">{p.code}</span>)
                </>
              )}
              : {p.reason}
            </li>
          ))}
      </ul>
    </section>
  );
}

function Report({ report: r, again }: { report: Extract<ImportState, { step: "done" }>["report"]; again: () => void }) {
  const problems = [...r.fileErrors, ...r.skipped];
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-green-300 bg-green-50 p-4">
        <h2 className="text-lg font-bold">✓ ذخیره شد</h2>
        <Summary
          rows={[
            { label: "قیمت عوض شد", n: r.pricesChanged.length, tone: "green" },
            { label: "دوباره موجود شد", n: r.madeAvailable, tone: "blue" },
            { label: "ناموجود شد", n: r.madeUnavailable.length, tone: "red" },
            { label: "کالای تازه ساخته شد", n: r.created, tone: "amber" },
          ]}
        />
        {r.madeUnavailable.length > 0 && <GoodsList title="کالاهایی که ناموجود شدند" goods={r.madeUnavailable} />}
        {r.pricesChanged.length > 0 && <PriceList title="قیمت عوض شد" rows={r.pricesChanged} />}
      </section>
      {problems.length > 0 && <Problems problems={problems} />}
      <Button type="button" variant="outline" className="w-fit" onClick={again}>
        ورود فایل دیگر
      </Button>
    </div>
  );
}
