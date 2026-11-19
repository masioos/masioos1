"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
      <Input id="cardNumber" name="cardNumber" inputMode="numeric" dir="ltr" required />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">انبار ثبت شد.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "در حال ثبت…" : "ثبت انبار"}
      </Button>
    </form>
  );
}
