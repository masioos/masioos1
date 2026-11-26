"use client";

import { useActionState, useState, useTransition } from "react";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSellerAction,
  deleteSellerAction,
  editSellerAction,
  resetPasswordAction,
  type SellerState,
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

/**
 * «ویرایش» opens the name and mobile boxes of one seller; «حذف» asks once more before removing the
 * seller from the list (their name stays in request history).
 */
export function SellerRowActions({ staffId, fullName, mobile }: { staffId: string; fullName: string; mobile: string }) {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [editState, editAction, saving] = useActionState(async (prev: SellerState, fd: FormData) => {
    const res = await editSellerAction(prev, fd);
    if (res.ok) setMode("idle");
    return res;
  }, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteSellerAction, {});

  if (mode === "edit") {
    return (
      <form action={editAction} className="flex flex-col gap-2">
        <input type="hidden" name="staffId" value={staffId} />
        <Input name="fullName" aria-label="نام و نام خانوادگی" defaultValue={fullName} className="w-48" />
        <Input name="mobile" aria-label="شماره همراه" dir="ltr" inputMode="tel" defaultValue={mobile} className="w-48" />
        <span className="flex gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMode("idle")}>
            انصراف
          </Button>
        </span>
        {editState.error && <span className="text-destructive text-xs">{editState.error}</span>}
      </form>
    );
  }
  if (mode === "delete") {
    return (
      <form action={deleteAction} className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-2">
        <input type="hidden" name="staffId" value={staffId} />
        <span className="text-xs">«{fullName}» حذف شود؟ دیگر نمی‌تواند وارد شود. نامش در تاریخچه‌ی فاکتورها می‌ماند.</span>
        <span className="flex gap-2">
          <Button type="submit" size="sm" variant="destructive" disabled={deleting}>
            {deleting ? "در حال حذف…" : "بله، حذف شود"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMode("idle")}>
            نه
          </Button>
        </span>
        {deleteState.error && <span className="text-destructive text-xs">{deleteState.error}</span>}
      </form>
    );
  }
  return (
    <span className="flex gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => setMode("edit")}>
        ویرایش
      </Button>
      <Button type="button" size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => setMode("delete")}>
        حذف
      </Button>
      {editState.ok && <span className="self-center text-xs text-green-700">✓ ذخیره شد</span>}
    </span>
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
