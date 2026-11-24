import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isUuid } from "../ids";
import { canDo, HISTORY_LABELS, rowProfit, parseStaffTab, profitTotal, quantityTotal, STAFF_STATUS_NAMES, STAFF_TABS } from "../rules";
import { canSee, requireStaff } from "@/modules/staff";
import { getRequestForStaff, listRequestsForStaff, staffTabCounts } from "../service";
import { ClickableRow } from "./clickable-row";
import { fa, faDateTime, toman } from "./format";
import {
  discountLabel,
  goodsBoxClass,
  Messages,
  profitCellClass,
  RowsTable,
  StatusBadge,
  TotalFooter,
} from "./request-view";
import { AddRowForm, InvoiceDiscountForm, ReopenForm, RowEditForm, StaffActions } from "./staff-forms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Staff list in tabs (تازه، در حال انجام، پرداخت شده، باطل شده، همه): new and changed first. */
export async function RequestsTable({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff();
  const sp = await searchParams;
  const tab = parseStaffTab(sp.tab);
  const [list, counts] = await Promise.all([listRequestsForStaff(tab), staffTabCounts()]);
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2 border-b pb-2 text-sm">
        {STAFF_TABS.map((t) => (
          <Link
            key={t.tab}
            href={t.tab === "new" ? "/admin/requests" : `/admin/requests?tab=${t.tab}`}
            aria-current={t.tab === tab ? "page" : undefined}
            className={
              t.tab === tab
                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-bold"
                : "hover:bg-muted rounded-md px-3 py-1.5"
            }
          >
            {t.name} ({fa(counts[t.tab].n)})
            {t.tab !== "all" && counts[t.tab].attention > 0 && (
              <span className="ms-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white" title="پیام یا تغییر تازه از مشتری">
                {fa(counts[t.tab].attention)}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <p>درخواستی نیست.</p>
      ) : (
        <Table className="[&_tbody_tr]:border-b-2 [&_tbody_tr]:border-zinc-300">
          <TableHeader>
            <TableRow>
              <TableHead>شماره</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تیکت</TableHead>
              <TableHead>تعداد اقلام</TableHead>
              <TableHead>جمع</TableHead>
              <TableHead>زمان ثبت</TableHead>
              <TableHead>آخرین رسیدگی</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <ClickableRow
                key={r.id}
                href={`/admin/requests/${r.id}`}
                className={r.needsAttention ? "bg-amber-50 font-medium" : ""}
              >
                <TableCell>
                  <Link href={`/admin/requests/${r.id}`} className="text-primary underline">
                    {fa(r.number)}
                  </Link>
                  {r.needsAttention && <span className="ms-2 rounded-full bg-amber-500 px-2 text-xs text-white">تازه</span>}
                </TableCell>
                <TableCell>
                  {r.customerName}
                  <span className="text-muted-foreground block text-end text-xs" dir="ltr">
                    {r.mobile}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} names={STAFF_STATUS_NAMES} />
                </TableCell>
                <TableCell>
                  {r.hasNote && <Check className="size-5 text-green-700" aria-label="توضیحات دارد" />}
                </TableCell>
                <TableCell>{fa(r.rowCount)}</TableCell>
                <TableCell>{toman(r.total)}</TableCell>
                <TableCell>{faDateTime(r.createdAt)}</TableCell>
                <TableCell>{r.lastHandledBy ?? "—"}</TableCell>
                <TableCell>
                  <Link href={`/admin/requests/${r.id}`} className="text-primary text-sm underline">
                    باز کردن
                  </Link>
                </TableCell>
              </ClickableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** One request for staff: shopper, rows (editable while awaiting), note, messages, confirm / reject. */
export async function StaffRequest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireStaff();
  const r = await getRequestForStaff(id, viewer);
  if (!r) notFound();
  const editable = canDo("staffEdit", r.status);
  // Sellers see the «پرافیت» column only when the manager allowed it for them.
  const profit = canSee(viewer, "profit") ? profitTotal(r.rows, r.discount) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">درخواست {fa(r.number)}</h1>
        <StatusBadge status={r.status} names={STAFF_STATUS_NAMES} />
      </div>
      <section className="grid gap-1 rounded-xl border p-4 text-sm">
        <p>
          مشتری: <span className="font-medium">{r.customer?.fullName}</span>
        </p>
        <p>
          همراه:{" "}
          <a href={`tel:${r.customer?.mobile}`} dir="ltr" className="text-primary">
            {r.customer?.mobile}
          </a>
        </p>
        {r.customer?.email && <p>ایمیل: {r.customer.email}</p>}
        <p>آدرس: {r.address}</p>
        <p>ثبت: {faDateTime(r.createdAt)}</p>
        {r.deadlineAt && r.status !== "awaiting" && <p>مهلت پاسخ مشتری: {faDateTime(r.deadlineAt)}</p>}
        {r.rejectReason && <p className="text-destructive">دلیل رد: {r.rejectReason}</p>}
      </section>

      {r.note && (
        <section className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-bold">توضیحات مشتری</h2>
          <p className="text-sm whitespace-pre-line">{r.note}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">ردیف‌ها</h2>
        {editable ? (
          <>
            <div className={goodsBoxClass}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">ردیف</TableHead>
                    <TableHead>کالا</TableHead>
                    <TableHead>قیمت واحد (تومان)</TableHead>
                    <TableHead>تعداد</TableHead>
                    <TableHead>تخفیف</TableHead>
                    <TableHead className="text-center">ناموجود</TableHead>
                    <TableHead>جمع</TableHead>
                    <TableHead />
                    {profit && <TableHead className={profitCellClass}>پرافیت</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.rows.map((row, i) => (
                    <RowEditForm
                      key={row.id}
                      index={i + 1}
                      rowId={row.id}
                      name={row.name}
                      code={row.code}
                      unit={row.unit}
                      price={row.priceToman}
                      quantity={row.quantity}
                      discountPercent={row.discountPercent}
                      isUnavailable={row.isUnavailable}
                      warehouse={row.warehouseId ? (r.warehouseNames[row.warehouseId] ?? "") : ""}
                      // The raw purchase price reaches the browser only with that permission; otherwise
                      // the row shows the profit worked out here (it updates after each save).
                      purchasePrice={canSee(viewer, "purchasePrice") ? row.purchasePriceToman : null}
                      hasPurchasePrice={row.purchasePriceToman !== null}
                      savedProfit={rowProfit(row)}
                      manualProfit={row.manualProfitToman}
                      showProfit={!!profit}
                    />
                  ))}
                </TableBody>
                <TotalFooter
                  cols={7}
                  total={r.total}
                  hasUnpriced={r.hasUnpriced}
                  trailing={1}
                  discount={{ subtotal: r.subtotal, amount: r.discount, label: discountLabel(r.discountKind, r.discountValue) }}
                  profit={profit}
                  quantity={{ col: 3, total: quantityTotal(r.rows) }}
                  control={<InvoiceDiscountForm requestId={r.id} kind={r.discountKind} value={r.discountValue} />}
                />
              </Table>
            </div>
            {r.hasUnpriced && <p className="text-destructive text-sm">بعضی ردیف‌ها قیمت ندارند. قبل از تأیید قیمت بگذارید.</p>}
            <AddRowForm requestId={r.id} />
          </>
        ) : (
          <>
            <RowsTable {...r} profit={profit} staffView />
            {canDo("reopen", r.status) && <ReopenForm requestId={r.id} accepted={r.status === "accepted"} />}
          </>
        )}
      </section>

      {r.history.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">تاریخچه</h2>
          <ul className="text-muted-foreground flex flex-col gap-0.5 text-sm">
            {r.history.map((h, i) => (
              <li key={i}>
                {faDateTime(h.at)} — <span className="text-foreground font-medium">{h.name}</span>: {HISTORY_LABELS[h.kind]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Messages messages={r.messages} viewer="staff" />
      {canDo("message", r.status) && (
        <StaffActions requestId={r.id} canConfirm={canDo("confirm", r.status)} canReject={canDo("reject", r.status)} />
      )}
    </div>
  );
}