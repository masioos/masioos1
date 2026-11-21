"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveListItemAction } from "../actions";
import type { ListKind } from "../rules";

type Item = { id: string; name: string; parentId?: string | null };

const selectClass = "h-8 rounded-lg border border-input bg-background px-2 text-sm";

// One row: rename an existing item, or (no item) add a new one.
function ItemForm({
  kind,
  item,
  parents,
}: {
  kind: ListKind;
  item?: Item;
  parents?: Item[];
}) {
  const [state, formAction, pending] = useActionState(saveListItemAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Input
        name="name"
        aria-label="نام"
        defaultValue={item?.name}
        placeholder={item ? undefined : "نام جدید"}
        className="w-64"
        required
      />
      {parents && (
        <select
          name="parentId"
          aria-label="دسته‌ی اصلی"
          defaultValue={item?.parentId ?? ""}
          className={selectClass}
        >
          <option value="">— دسته‌ی اصلی است —</option>
          {parents
            .filter((p) => p.id !== item?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                زیرمجموعه‌ی {p.name}
              </option>
            ))}
        </select>
      )}
      <Button type="submit" size="sm" variant={item ? "outline" : "default"} disabled={pending}>
        {item ? "ذخیره" : "افزودن"}
      </Button>
      {state.error && <span className="text-destructive text-sm">{state.error}</span>}
      {state.ok && !pending && item && <span className="text-sm text-green-700">ذخیره شد</span>}
    </form>
  );
}

export function ListManager({
  kind,
  title,
  items,
}: {
  kind: ListKind;
  title: string;
  items: Item[];
}) {
  // Categories: only main (top-level) ones can be a parent — two levels.
  const parents = kind === "categories" ? items.filter((i) => !i.parentId) : undefined;
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <ItemForm key={`new-${items.length}`} kind={kind} parents={parents} />
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">هنوز چیزی ثبت نشده است.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <ItemForm kind={kind} item={item} parents={parents} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
