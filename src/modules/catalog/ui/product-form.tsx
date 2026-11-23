"use client";

import { useActionState } from "react";
import { PriceInput } from "@/components/price-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductAction, updateProductAction } from "../actions";
import { categoryOptions, selectClass } from "./options";

type Option = { id: string; name: string; parentId?: string | null };

export type ProductFormOptions = {
  warehouses: Option[];
  cars: Option[];
  categories: Option[];
  brands: Option[];
  countries: Option[];
  partGroups: Option[];
};

export type ProductFormValues = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  brandId: string | null;
  categoryId: string | null;
  countryId: string | null;
  partGroupId: string | null;
  description: string;
  purchasePriceToman: number | null;
  unit: "piece" | "pair";
  carIds: string[];
};

function Select({
  name,
  label,
  options,
  value,
  required,
}: {
  name: string;
  label: string;
  options: { id: string; label: string }[];
  value?: string | null;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={value ?? ""} required={required} className={selectClass}>
        <option value="">{required ? "— انتخاب کنید —" : "— ندارد —"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const asOptions = (list: Option[]) => list.map((o) => ({ id: o.id, label: o.name }));

/** Create (no `product`) or edit a product. Staff only: shows the purchase price. */
export function ProductForm({
  options,
  product,
}: {
  options: ProductFormOptions;
  product?: ProductFormValues;
}) {
  const [state, formAction, pending] = useActionState(
    product ? updateProductAction : createProductAction,
    {},
  );
  // After an error, show what staff typed (React clears the form after every action).
  const typed = state.error ? state.values : undefined;
  const text = (key: keyof ProductFormValues) => {
    const v = typed?.[key];
    if (typed) return typeof v === "string" ? v : "";
    const p = product?.[key];
    return p === null || p === undefined ? "" : String(p);
  };
  const carIds = new Set(typed ? [typed.carIds ?? []].flat() : (product?.carIds ?? []));

  return (
    <form key={state.attempt ?? 0} action={formAction} className="grid max-w-2xl gap-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <Select
        name="warehouseId"
        label="انبار"
        options={asOptions(options.warehouses)}
        value={text("warehouseId")}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">نام کالا</Label>
          <Input id="name" name="name" defaultValue={text("name")} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="code">کد فنی</Label>
          <Input id="code" name="code" defaultValue={text("code")} dir="ltr" required />
        </div>
        <Select name="brandId" label="برند" options={asOptions(options.brands)} value={text("brandId")} />
        <Select
          name="countryId"
          label="کشور سازنده"
          options={asOptions(options.countries)}
          value={text("countryId")}
        />
        <Select
          name="categoryId"
          label="دسته"
          options={categoryOptions(options.categories)}
          value={text("categoryId")}
        />
        <Select
          name="partGroupId"
          label="گروه قطعه (برای «مدل‌های دیگر این قطعه»)"
          options={asOptions(options.partGroups)}
          value={text("partGroupId")}
        />
        <Select
          name="unit"
          label="واحد فروش"
          options={[
            { id: "piece", label: "عدد" },
            { id: "pair", label: "جفت" },
          ]}
          value={text("unit") || "piece"}
          required
        />
        <div className="grid gap-1.5">
          <Label htmlFor="purchasePriceToman">قیمت خرید (تومان) — خالی یعنی «برای قیمت تماس بگیرید»</Label>
          <PriceInput id="purchasePriceToman" name="purchasePriceToman" defaultValue={text("purchasePriceToman")} />
        </div>
      </div>

      <fieldset className="grid gap-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">خودروهای سازگار</legend>
        {options.cars.length === 0 ? (
          <p className="text-muted-foreground text-sm">اول در «فهرست‌ها» خودرو اضافه کنید.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {options.cars.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="carIds" value={c.id} defaultChecked={carIds.has(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="description">توضیحات</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={text("description")}
          rows={4}
          className="rounded-lg border border-input bg-background p-2 text-sm"
        />
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-green-700">ذخیره شد.</p>}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "در حال ذخیره…" : product ? "ذخیره‌ی تغییرات" : "ثبت کالا"}
      </Button>
    </form>
  );
}
