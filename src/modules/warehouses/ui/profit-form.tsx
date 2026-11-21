"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setWarehouseProfitAction } from "../actions";

// Inline edit of one warehouse's profit percent, inside the warehouses table.
export function ProfitForm({ id, percent }: { id: string; percent: string }) {
  const [state, formAction, pending] = useActionState(setWarehouseProfitAction, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Input
        name="profitBp"
        aria-label="درصد سود"
        defaultValue={percent}
        inputMode="decimal"
        dir="ltr"
        className="w-20"
      />
      <span>٪</span>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        ذخیره
      </Button>
      {state.error && <span className="text-destructive text-xs">{state.error}</span>}
      {state.ok && !pending && <span className="text-xs text-green-700">ذخیره شد</span>}
    </form>
  );
}
