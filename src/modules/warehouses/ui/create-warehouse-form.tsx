"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CardInput } from "@/components/card-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWarehouseAction } from "../actions";

export function CreateWarehouseForm() {
  const [state, formAction, pending] = useActionState(createWarehouseAction, {});

  return (
    <form action={formAction} className="grid max-w-md gap-3">
      <Label htmlFor="name">نام انبار</Label>
      <Input id="name" name="name" required />
      <Label htmlFor="ownerName">صاحب انبار</Label>
      <Input id="ownerName" name="ownerName" required />
      <Label htmlFor="cardNumber">شماره کارت</Label>
      <CardInput id="cardNumber" name="cardNumber" required />
      <Label htmlFor="cardHolder">نام صاحب کارت</Label>
      <Input id="cardHolder" name="cardHolder" required />
      <Label htmlFor="profitBp">درصد سود (روی قیمت خرید)</Label>
      <Input id="profitBp" name="profitBp" inputMode="decimal" dir="ltr" defaultValue="0" required />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">انبار ثبت شد.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "در حال ثبت…" : "ثبت انبار"}
      </Button>
    </form>
  );
}
