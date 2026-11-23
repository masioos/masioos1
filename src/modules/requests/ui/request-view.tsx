import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rowTotal, type Status } from "../rules";
import type { RequestDetails } from "../service";
import { fa, faDateTime, toman, UNIT_NAMES } from "./format";

const STATUS_COLORS: Record<Status, string> = {
  awaiting: "bg-amber-100 text-amber-900",
  confirmed: "bg-blue-100 text-blue-900",
  accepted: "bg-green-100 text-green-900",
  cancelled: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
  declined: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, names }: { status: Status; names: Record<Status, string> }) {
  return <span className={`rounded-md px-2 py-0.5 text-sm font-medium ${STATUS_COLORS[status]}`}>{names[status]}</span>;
}

/** Shown under a total that still misses some prices. */
export const UNPRICED_NOTE = "به‌اضافه‌ی قیمت کالاهایی که بعد از تأیید مشخص می‌شود";

/** The box goods tables sit in: border, rounded, light header. */
export const goodsBoxClass = "overflow-hidden rounded-xl border [&_thead]:bg-muted/50";

/** Numbered rows with the total inside the box. Shared by the shopper and staff pages (staff add the warehouse column). */
export function RowsTable({
  rows,
  total,
  hasUnpriced,
  warehouseNames,
  subtotal,
  discount,
  discountKind,
  discountValue,
}: Pick<RequestDetails, "rows" | "total" | "hasUnpriced" | "subtotal" | "discount" | "discountKind" | "discountValue"> & {
  warehouseNames?: Record<string, string>;
}) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">این درخواست ردیف کالا ندارد.</p>;
  const hasDiscount = rows.some((r) => r.discountPercent > 0);
  const cols = 5 + (warehouseNames ? 1 : 0) + (hasDiscount ? 1 : 0);
  return (
    <div className={goodsBoxClass}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">ردیف</TableHead>
            <TableHead>کالا</TableHead>
            {warehouseNames && <TableHead>انبار</TableHead>}
            <TableHead>تعداد</TableHead>
            <TableHead>قیمت واحد</TableHead>
            {hasDiscount && <TableHead>تخفیف</TableHead>}
            <TableHead>جمع</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.id} className={r.isUnavailable ? "text-muted-foreground line-through" : ""}>
              <TableCell className="text-center">{fa(i + 1)}</TableCell>
              <TableCell className="max-w-72 whitespace-normal">
                {r.name}
                {r.code && (
                  <span className="text-muted-foreground block text-end text-xs" dir="ltr">
                    {r.code}
                  </span>
                )}
                {r.isUnavailable && <span className="text-destructive ms-2 text-xs no-underline">ناموجود</span>}
              </TableCell>
              {warehouseNames && <TableCell>{r.warehouseId ? warehouseNames[r.warehouseId] : "—"}</TableCell>}
              <TableCell>
                {fa(r.quantity)} {UNIT_NAMES[r.unit]}
              </TableCell>
              <TableCell>{r.priceToman === null ? "برای قیمت تماس بگیرید" : toman(r.priceToman)}</TableCell>
              {hasDiscount && <TableCell>{r.discountPercent > 0 ? `${fa(r.discountPercent)}٪` : "—"}</TableCell>}
              <TableCell>
                {r.priceToman === null || r.isUnavailable ? "—" : toman(rowTotal({ ...r, priceToman: r.priceToman }))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TotalFooter
          cols={cols}
          total={total}
          hasUnpriced={hasUnpriced}
          discount={{ subtotal, amount: discount, label: discountLabel(discountKind, discountValue) }}
        />
      </Table>
    </div>
  );
}

/** The «جمع کل» row at the bottom of a goods table. */
export function TotalFooter({
  cols,
  total,
  hasUnpriced,
  trailing = 0,
  discount,
  control,
}: {
  cols: number;
  total: number;
  hasUnpriced: boolean;
  /** Empty cells after the total (a «ذخیره» or «حذف» column). */
  trailing?: number;
  /** The whole-invoice discount; its rows show only when it is more than zero. */
  discount?: { subtotal: number; amount: number; label: string };
  /** Shown beside «جمع کل» (the staff «تخفیف» box). */
  control?: ReactNode;
}) {
  const after = trailing > 0 ? <TableCell colSpan={trailing} /> : null;
  return (
    <TableFooter>
      {discount && discount.amount > 0 && (
        <>
          <TableRow>
            <TableCell colSpan={cols - 1} className="text-end">
              جمع ردیف‌ها
            </TableCell>
            <TableCell>{toman(discount.subtotal)}</TableCell>
            {after}
          </TableRow>
          <TableRow>
            <TableCell colSpan={cols - 1} className="text-end text-green-700">
              {discount.label}
            </TableCell>
            <TableCell className="text-green-700">− {toman(discount.amount)}</TableCell>
            {after}
          </TableRow>
        </>
      )}
      <TableRow>
        <TableCell colSpan={cols - 1} className="font-bold">
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
            {control}
            <span>جمع کل</span>
          </div>
        </TableCell>
        <TableCell className="text-base font-bold">
          {toman(total)}
          {hasUnpriced && <span className="text-muted-foreground block text-xs font-normal whitespace-normal">{UNPRICED_NOTE}</span>}
        </TableCell>
        {after}
      </TableRow>
    </TableFooter>
  );
}

/** The conversation on a request. `viewer` decides whose messages are «you». */
export function Messages({ messages, viewer }: Pick<RequestDetails, "messages"> & { viewer: "shopper" | "staff" }) {
  if (messages.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-bold">پیام‌ها</h2>
      <ul className="flex flex-col gap-2">
        {messages.map((m) => {
          const mine = viewer === "shopper" ? m.fromShopper : !m.fromShopper;
          const who = m.fromShopper ? (viewer === "shopper" ? "شما" : "مشتری") : "فروشگاه";
          return (
            <li
              key={m.id}
              className={`max-w-[85%] rounded-lg p-3 text-sm ${mine ? "bg-primary/10 self-start" : "bg-amber-50 self-end border border-amber-200"}`}
            >
              <p className="mb-1 text-xs font-bold">{who}</p>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="text-muted-foreground mt-1 text-xs">{faDateTime(m.createdAt)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** «تخفیف فاکتور (۵٪)» or «تخفیف فاکتور». */
export function discountLabel(kind: RequestDetails["discountKind"], value: number): string {
  return kind === "percent" ? `تخفیف فاکتور (${fa(value)}٪)` : "تخفیف فاکتور";
}
