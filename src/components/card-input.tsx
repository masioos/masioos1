"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { groupCard } from "@/lib/card";
import { digitsOnly } from "@/lib/money";

/**
 * A bank card box: digits only (Persian digits become Latin), at most 16, shown in groups of four
 * («6037 9975 1234 5678») while typing. The server drops the spaces again.
 */
export function CardInput({
  defaultValue,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue" | "value" | "onChange" | "type" | "maxLength"> & {
  defaultValue?: string | null;
}) {
  const shown = (text: string) => groupCard(digitsOnly(text).slice(0, 16));
  const [value, setValue] = useState(shown(defaultValue ?? ""));
  return (
    <Input
      {...props}
      type="text"
      dir="ltr"
      inputMode="numeric"
      autoComplete="off"
      maxLength={19}
      placeholder={props.placeholder ?? "0000 0000 0000 0000"}
      value={value}
      onChange={(e) => setValue(shown(e.currentTarget.value))}
      className={`font-mono tracking-wide ${props.className ?? ""}`}
    />
  );
}
