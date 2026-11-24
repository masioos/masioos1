"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { digitsOnly, groupAscii } from "@/lib/money";

/** Groups the digits; with `allowNegative`, a leading «-» (or «−») stays. */
function shown(text: string, allowNegative: boolean): string {
  const negative = allowNegative && /^\s*[-−]/.test(text);
  return (negative ? "-" : "") + groupAscii(digitsOnly(text));
}

/**
 * A Toman price box that shows what is typed in groups of three («12/000/000»).
 * The form still sends the text; the server reads it with its own parser, which skips the «/».
 */
export function PriceInput({
  defaultValue,
  allowNegative = false,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue" | "value" | "onChange" | "type"> & {
  defaultValue?: number | string | null;
  /** For an amount that can be a loss (a typed profit). Phones then show a keyboard with «-». */
  allowNegative?: boolean;
}) {
  const [value, setValue] = useState(shown(String(defaultValue ?? ""), allowNegative));
  return (
    <Input
      {...props}
      type="text"
      dir="ltr"
      inputMode={allowNegative ? "text" : "numeric"}
      value={value}
      onChange={(e) => setValue(shown(e.currentTarget.value, allowNegative))}
    />
  );
}
