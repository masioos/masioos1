"use client";

import { SHOP_PAGE_SIZES } from "../rules";
import { selectClass } from "./options";

/** «تعداد در هر صفحه». Changing it runs the search again from page 1. */
export function PageSizeSelect({ value }: { value: number }) {
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm whitespace-nowrap">
      تعداد در هر صفحه
      <select
        name="size"
        defaultValue={String(value)}
        className={`${selectClass} w-20`}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {SHOP_PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n.toLocaleString("fa-IR")}
          </option>
        ))}
      </select>
    </label>
  );
}
