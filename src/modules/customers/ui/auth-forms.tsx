"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, registerAction } from "../actions";

function Field({
  name,
  label,
  type = "text",
  value,
  required = true,
  ltr,
  hint,
  autoComplete,
  inputMode,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  ltr?: boolean;
  hint?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email";
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        dir={ltr ? "ltr" : undefined}
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

const withNext = (path: string, next: string) =>
  next && next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path;

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, {});
  return (
    <form key={state.attempt ?? 0} action={formAction} className="grid max-w-sm gap-4" autoComplete="on">
      <input type="hidden" name="next" value={next} />
      <Field
        name="mobile"
        label="نام کاربری (شماره همراه پیش فرض)"
        value={state.values?.mobile}
        ltr
        autoComplete="username"
        inputMode="tel"
      />
      <PasswordField label="رمز" autoComplete="current-password" />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "در حال ورود…" : "ورود"}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link className="text-primary underline" href={withNext("/account/register", next)}>
          حساب ندارید؟ ثبت‌نام
        </Link>
        <Link className="text-primary underline" href="/account/forgot">
          رمز را فراموش کرده‌اید؟
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(registerAction, {});
  const v = state.values ?? {};
  return (
    <form key={state.attempt ?? 0} action={formAction} className="grid max-w-sm gap-4">
      <input type="hidden" name="next" value={next} />
      <Field name="fullName" label="نام و نام خانوادگی" value={v.fullName} />
      <Field
        name="mobile"
        label="شماره همراه"
        value={v.mobile}
        ltr
        hint="با این شماره وارد می‌شوید."
        autoComplete="username"
        inputMode="tel"
      />
      <Field
        name="email"
        label="ایمیل (اختیاری)"
        type="email"
        value={v.email}
        required={false}
        ltr
        autoComplete="email"
      />
      <PasswordField label="رمز (حداقل ۶ حرف یا عدد)" autoComplete="new-password" />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "در حال ثبت…" : "ساخت حساب"}
      </Button>
      <Link className="text-primary text-sm underline" href={withNext("/account/login", next)}>
        حساب دارید؟ وارد شوید
      </Link>
    </form>
  );
}
