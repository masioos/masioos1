"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPasswordAction } from "../actions";

/** Staff: a new password for a shopper who called support. */
export function SetPasswordForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <Input name="password" aria-label="رمز تازه" placeholder="رمز تازه" dir="ltr" className="w-36" required />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        گذاشتن رمز
      </Button>
      {state.error && <span className="text-destructive text-xs">{state.error}</span>}
      {state.ok && !pending && <span className="text-xs text-green-700">رمز عوض شد</span>}
    </form>
  );
}
