"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addToCartAction } from "../actions";
import { maxQuantity, type Unit } from "../rules";
import { fa, selectClass, UNIT_NAMES } from "./format";

/** «افزودن به سبد» on the product page. Unavailable products get no button. */
export function AddToCartButton({
  productId,
  unit,
  isUnavailable,
  compact = false,
}: {
  productId: string;
  unit: Unit;
  isUnavailable: boolean;
  /** The small version in the shop list (shown on hover). */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(addToCartAction, {});
  if (compact) {
    if (isUnavailable) return null;
    return (
      <form action={formAction} className="flex items-center gap-1.5">
        <input type="hidden" name="productId" value={productId} />
        <select name="quantity" defaultValue="1" aria-label="تعداد" className={`${selectClass} w-20`}>
          {Array.from({ length: maxQuantity(unit) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {fa(n)} {UNIT_NAMES[unit]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending} className="flex-1">
          <ShoppingCart className="size-4" />
          {pending ? "…" : state.ok ? "اضافه شد" : "افزودن"}
        </Button>
        {state.error && <span className="text-destructive text-xs">{state.error}</span>}
      </form>
    );
  }
  if (isUnavailable) {
    return <p className="text-muted-foreground text-sm">این کالا فعلاً ناموجود است و به سبد اضافه نمی‌شود.</p>;
  }
  const max = maxQuantity(unit);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label className="flex items-center gap-2 text-sm">
        تعداد
        <select name="quantity" defaultValue="1" className={selectClass}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {fa(n)} {UNIT_NAMES[unit]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "در حال افزودن…" : "افزودن به سبد"}
      </Button>
      {state.ok && !pending && (
        <span className="text-sm text-green-700">
          به سبد اضافه شد.{" "}
          <Link href="/cart" className="text-primary underline">
            دیدن سبد
          </Link>
        </span>
      )}
      {state.error && <span className="text-destructive text-sm">{state.error}</span>}
      <p className="text-muted-foreground w-full text-xs">
        حداکثر {fa(max)} {UNIT_NAMES[unit]}. اگر بیشتر می‌خواهید، در سبد در کادر توضیحات بنویسید.
      </p>
    </form>
  );
}
