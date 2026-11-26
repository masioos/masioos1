"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CardInput } from "@/components/card-input";
import { Input } from "@/components/ui/input";
import { setWarehouseCardAction } from "../actions";

// Inline edit of one warehouse's card number and the name on it, inside the warehouses table.
export function CardForm({ id, cardNumber, cardHolder }: { id: string; cardNumber: string; cardHolder: string }) {
  const [state, formAction, pending] = useActionState(setWarehouseCardAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <CardInput name="cardNumber" aria-label="شماره کارت" defaultValue={cardNumber} className="w-60" />
      <Input name="cardHolder" aria-label="نام صاحب کارت" placeholder="نام صاحب کارت" defaultValue={cardHolder} className="w-40" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        ذخیره
      </Button>
      {state.error && <span className="text-destructive text-xs">{state.error}</span>}
      {state.ok && !pending && <span className="text-xs text-green-700">ذخیره شد</span>}
    </form>
  );
}
