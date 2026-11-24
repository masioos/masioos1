"use client";

import { useActionState, useState, useTransition } from "react";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSellerAction,
  resetPasswordAction,
  setSwitchAction,
  staffSignInAction,
  type PasswordState,
} from "../actions";

/** Staff sign-in: mobile + password. */
export function StaffLoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(staffSignInAction, {});
  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border p-6">
      <h1 className="text-xl font-bold">ورود کارکنان</h1>
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-1.5">
        <Label htmlFor="mobile">شماره همراه</Label>
        <Input
          key={state.attempt}
          id="mobile"
          name="mobile"
          dir="ltr"
          inputMode="tel"
          autoComplete="username"
          defaultValue={state.mobile}
          required
        />
      </div>
      <PasswordField label="رمز" autoComplete="current-password" />
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "در حال ورود…" : "ورود"}
      </Button>
    </form>
  );
}

/** The one-time password box the manager reads out to the seller. */
function ShownPassword({ state }: { state: PasswordState }) {
  if (state.error) return <span className="text-destructive text-xs">{state.error}</span>;
  if (!state.password) return null;
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs">
      رمز:
      <code dir="ltr" className="text-base font-bold select-all">
        {state.password}
      </code>
      <span className="text-muted-foreground">این رمز فقط همین یک بار نشان داده می‌شود</span>
    </span>
  );
}

export function AddSellerForm() {
  const [state, formAction, pending] = useActionState(addSellerAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="fullName">نام و نام خانوادگی</Label>
        <Input key={`n${state.attempt}`} id="fullName" name="fullName" required className="w-56" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sellerMobile">شماره همراه</Label>
        <Input key={`m${state.attempt}`} id="sellerMobile" name="mobile" dir="ltr" inputMode="tel" required className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        افزودن فروشنده
      </Button>
      <ShownPassword state={state} />
    </form>
  );
}

export function ResetPasswordButton({ staffId }: { staffId: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="staffId" value={staffId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        رمز جدید
      </Button>
      <ShownPassword state={state} />
    </form>
  );
}

/** A tick that saves at once (active / purchase price / profit). */
export function SwitchBox({
  staffId,
  which,
  on,
  label,
}: {
  staffId: string;
  which: "active" | "purchasePrice" | "profit";
  on: boolean;
  label: string;
}) {
  const [checked, setChecked] = useState(on);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        aria-label={label}
        className="size-4"
        checked={checked}
        disabled={pending}
        onChange={(e) => {
          const next = e.currentTarget.checked;
          setChecked(next);
          setError(undefined);
          const fd = new FormData();
          fd.set("staffId", staffId);
          fd.set("which", which);
          fd.set("on", String(next));
          start(async () => {
            const res = await setSwitchAction(fd);
            if (res.error) {
              setChecked(!next);
              setError(res.error);
            }
          });
        }}
      />
      {error && <span className="text-destructive text-xs">{error}</span>}
    </span>
  );
}
