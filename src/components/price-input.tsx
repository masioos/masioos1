"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { digitsOnly, groupAscii } from "@/lib/money";

/**
 * A Toman price box that shows what is typed in groups of three («12/000/000»).
 * The form still sends the text; the server reads it with its own parser, which skips the «/».
 */
export function PriceInput({
  defaultValue,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue" | "value" | "onChange" | "type"> & {
  defaultValue?: number | string | null;
}) {
  const [value, setValue] = useState(groupAscii(digitsOnly(String(defaultValue ?? ""))));
  return (
    <Input
      {...props}
      type="text"
      dir="ltr"
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(groupAscii(digitsOnly(e.currentTarget.value)))}
    />
  );
}
