// Display helpers shared by the request screens. No DB; safe in client components.

import { groupFa } from "@/lib/money";

export const fa = (n: number) => groupFa(n);

export function toman(n: number): string {
  return `${groupFa(n)} تومان`;
}

/** «۲ آذر ۱۴۰۵، ۱۳:۴۵» in Tehran time. */
export function faDateTime(d: Date): string {
  return d.toLocaleString("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const UNIT_NAMES = { piece: "عدد", pair: "جفت" } as const;

export const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export const textareaClass =
  "w-full rounded-lg border border-input bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
