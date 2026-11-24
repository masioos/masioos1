"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A password box with an eye button that shows or hides what is typed. Used by shopper and staff sign-in.
 * `autoComplete` tells the browser which saved password goes here (and that the mobile above is
 * the user name), so Firefox and Chrome save both.
 */
export function PasswordField({ label, autoComplete }: { label: string; autoComplete: "current-password" | "new-password" }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="password">{label}</Label>
      <div className="relative" dir="ltr">
        <Input
          id="password"
          name="password"
          type={shown ? "text" : "password"}
          required
          dir="ltr"
          autoComplete={autoComplete}
          className="pe-10"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "پنهان کردن رمز" : "نمایش رمز"}
          title={shown ? "پنهان کردن رمز" : "نمایش رمز"}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 end-0 flex items-center px-3"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
