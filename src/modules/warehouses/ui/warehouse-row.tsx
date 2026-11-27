"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { CardInput } from "@/components/card-input";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { moveWarehouseAction, saveWarehouseAction } from "../actions";

type Part = "info" | "card" | "profit";

/**
 * One warehouse in the list, edited in place. Each part saves by itself a moment after typing
 * stops (or when the box is left): name + owner, card + the name on it (once the card has 16
 * digits), profit percent. Clicking the warehouse's button opens its panel below the list.
 */
export function WarehouseRow({
  w,
  selected,
  first,
  last,
}: {
  first: boolean;
  last: boolean;
  w: { id: string; name: string; ownerName: string; cardNumber: string; cardHolder: string; profit: string; isIsaco: boolean };
  selected: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timers = useRef<Partial<Record<Part, ReturnType<typeof setTimeout>>>>({});
  const lastSaved = useRef<Record<Part, string>>({
    info: `${w.name}|${w.ownerName}`,
    card: `${w.cardNumber}|${w.cardHolder}`,
    profit: w.profit,
  });
  const [status, setStatus] = useState<{ kind: "saving" | "saved" | "error"; text?: string }>();
  const [, start] = useTransition();

  const save = (part: Part) => {
    const form = formRef.current;
    if (!form) return;
    const all = new FormData(form);
    const value = (k: string) => String(all.get(k) ?? "").trim();
    const key =
      part === "info"
        ? `${value("name")}|${value("ownerName")}`
        : part === "card"
          ? `${value("cardNumber").replace(/\D/g, "")}|${value("cardHolder")}`
          : value("profitBp");
    if (key === lastSaved.current[part]) return;
    // A card is saved only when complete; until then nothing is sent.
    if (part === "card" && value("cardNumber").replace(/\D/g, "").length !== 16) return;
    const fd = new FormData();
    fd.set("id", w.id);
    fd.set("part", part);
    for (const k of part === "info" ? ["name", "ownerName"] : part === "card" ? ["cardNumber", "cardHolder"] : ["profitBp"]) {
      fd.set(k, String(all.get(k) ?? ""));
    }
    setStatus({ kind: "saving" });
    start(async () => {
      const res = await saveWarehouseAction(fd);
      if (res.error) setStatus({ kind: "error", text: res.error });
      else {
        lastSaved.current[part] = key;
        setStatus({ kind: "saved" });
      }
    });
  };
  const later = (part: Part, ms = 900) => {
    clearTimeout(timers.current[part]);
    timers.current[part] = setTimeout(() => save(part), ms);
  };
  /** Which part of the row a box belongs to. */
  const partOf = (t: EventTarget): Part | null => {
    const name = t instanceof Element ? t.getAttribute("name") : null;
    if (name === "name" || name === "ownerName") return "info";
    if (name === "cardNumber" || name === "cardHolder") return "card";
    return name === "profitBp" ? "profit" : null;
  };

  return (
    <TableRow className={selected ? "bg-blue-50" : ""}>
      <TableCell className="align-top">
        <Link
          href={selected ? "/admin/warehouses" : `/admin/warehouses?w=${w.id}#panel`}
          scroll={false}
          aria-expanded={selected}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm whitespace-nowrap ${selected ? "border-blue-400 bg-blue-100 text-blue-900" : "hover:bg-muted"}`}
        >
          {selected ? "▼" : "◀"} {w.isIsaco ? "ایساکو" : "پنل"}
        </Link>
      </TableCell>
      <TableCell className="p-0">
        <form
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
          onChange={(e) => {
            const p = partOf(e.target);
            if (p) later(p);
          }}
          onBlur={(e) => {
            const p = partOf(e.target);
            if (p) later(p, 0);
          }} className="grid grid-cols-[1fr_1fr_15rem_9rem_6rem] items-start gap-2 p-2">
          <Input name="name" aria-label="نام انبار" defaultValue={w.name} />
          <Input name="ownerName" aria-label="صاحب انبار" defaultValue={w.ownerName} />
          <div className="grid gap-1">
            <CardInput name="cardNumber" aria-label="شماره کارت" defaultValue={w.cardNumber} />
            <Input name="cardHolder" aria-label="نام صاحب کارت" placeholder="نام صاحب کارت" defaultValue={w.cardHolder} />
          </div>
          <span className="flex items-center gap-1">
            <Input name="profitBp" aria-label="درصد سود" inputMode="decimal" dir="ltr" placeholder="0" defaultValue={w.profit} className="w-20" />
            <span>٪</span>
          </span>
          <span className="pt-2 text-xs">
            {status?.kind === "saving" && <span className="text-muted-foreground">در حال ذخیره…</span>}
            {status?.kind === "saved" && <span className="text-green-700">✓ ذخیره شد</span>}
            {status?.kind === "error" && <span className="text-destructive">{status.text}</span>}
          </span>
        </form>
      </TableCell>
      <TableCell className="align-top">
        <form action={moveWarehouseAction} className="flex flex-col gap-1">
          <input type="hidden" name="id" value={w.id} />
          <button
            type="submit"
            name="direction"
            value="up"
            disabled={first}
            aria-label={`بردن ${w.name} یک ردیف بالاتر`}
            className="hover:bg-muted rounded border px-2 leading-6 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="submit"
            name="direction"
            value="down"
            disabled={last}
            aria-label={`بردن ${w.name} یک ردیف پایین‌تر`}
            className="hover:bg-muted rounded border px-2 leading-6 disabled:opacity-30"
          >
            ▼
          </button>
        </form>
      </TableCell>
    </TableRow>
  );
}
