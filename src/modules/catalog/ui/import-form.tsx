"use client";

import { useActionState } from "react";
import { groupFa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importStockSheetAction } from "../actions";
import { selectClass } from "./options";

const fa = (n: number) => groupFa(n);

export function ImportForm({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(importStockSheetAction, {});
  const r = state.report;
  const problems = r ? [...r.fileErrors, ...r.skipped].sort((a, b) => a.row - b.row) : [];

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="grid max-w-md gap-3">
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
          ستون‌های لازم: «کد فنی قطعه»، «نام قطعه»، «گروه خودرو»، «قیمت فروش (ریال)». کد جدید ← کالای
          جدید. کد تکراری ← فقط قیمت خرید به‌روز می‌شود.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "در حال خواندن فایل… (ممکن است چند ثانیه طول بکشد)" : "ورود کالاها"}
        </Button>
      </form>

      {state.error && <p className="text-destructive">{state.error}</p>}

      {r && !pending && (
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <h2 className="text-lg font-bold">نتیجه</h2>
          <ul className="grid gap-1">
            <li>کالای جدید: {fa(r.created)}</li>
            <li>قیمت به‌روز شد: {fa(r.updated)}</li>
            <li>رد شد: {fa(problems.length)}</li>
          </ul>
          {problems.length > 0 && (
            <ul className="grid max-h-80 gap-1 overflow-auto text-sm">
              {problems.map((p) => (
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
          )}
        </section>
      )}
    </div>
  );
}
