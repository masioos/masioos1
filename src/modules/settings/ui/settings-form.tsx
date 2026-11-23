"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettingsAction } from "../actions";

export function SettingsForm({ supportPhone }: { supportPhone: string }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, {});
  return (
    <form action={formAction} className="grid max-w-md gap-3">
      <Label htmlFor="supportPhone">شماره پشتیبانی (برای تماس و پیام مشتری‌ها)</Label>
      <Input id="supportPhone" name="supportPhone" defaultValue={supportPhone} inputMode="tel" dir="ltr" required />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-green-700">ذخیره شد.</p>}
      <Button type="submit" disabled={pending} className="justify-self-start">
        ذخیره
      </Button>
    </form>
  );
}
