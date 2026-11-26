import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentCustomer } from "@/modules/customers";
import { isUuid } from "../ids";
import { canDo, STATUS_NAMES } from "../rules";
import { getMyRequest, listMyRequests } from "../service";
import { faDateTime, toman, fa } from "./format";
import { ShopperPayment } from "./payment-view";
import { Messages, RowsTable, StatusBadge } from "./request-view";
import { AcceptDeclineButtons, CancelButton, ShopperMessageForm } from "./shopper-actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** «درخواست‌های من». */
export async function MyRequests() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login?next=/requests");
  const list = await listMyRequests(customer.id);
  if (list.length === 0) {
    return (
      <p>
        هنوز درخواستی ثبت نکرده‌اید.{" "}
        <Link href="/" className="text-primary underline">
          جست‌وجوی کالا
        </Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {list.map((r) => (
        <li key={r.id}>
          <Link href={`/requests/${r.id}`} className="hover:bg-muted/40 flex flex-wrap items-center gap-3 p-3">
            <span className="font-bold">درخواست {fa(r.number)}</span>
            <StatusBadge status={r.status} names={STATUS_NAMES} />
            {r.needsAttention && <span className="rounded-full bg-amber-500 px-2 text-xs text-white">پاسخ تازه</span>}
            <span className="text-muted-foreground text-sm">{faDateTime(r.createdAt)}</span>
            <span className="ms-auto text-sm">{toman(r.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One request, for its owner only. */
export async function MyRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, sp, customer] = await Promise.all([params, searchParams, getCurrentCustomer()]);
  if (!customer) redirect(`/account/login?next=/requests/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  const r = await getMyRequest(customer.id, id);
  if (!r) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">درخواست {fa(r.number)}</h1>
        <StatusBadge status={r.status} names={STATUS_NAMES} />
      </div>
      {sp.sent && r.status === "awaiting" && (
        <p className="rounded-lg bg-green-50 p-3 text-green-800">درخواست شما ثبت شد و در انتظار تأیید فروشگاه است.</p>
      )}
      {r.status === "confirmed" && r.deadlineAt && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p>
            فروشگاه درخواست شما را بررسی و تأیید کرد. فهرست و قیمت نهایی را ببینید و تا{" "}
            <span className="font-bold">{faDateTime(r.deadlineAt)}</span> پاسخ دهید.
          </p>
          <AcceptDeclineButtons requestId={r.id} deadlineSeen={r.deadlineAt?.toISOString() ?? ""} />
        </div>
      )}
      <ShopperPayment r={r} />
      {r.status === "expired" && (
        <p className="bg-muted rounded-lg p-3">مهلت این درخواست تمام شده است. اگر هنوز کالا را می‌خواهید، با پشتیبانی تماس بگیرید یا دوباره درخواست دهید.</p>
      )}
      {r.status === "rejected" && (
        <p className="bg-destructive/5 text-destructive rounded-lg p-3">این درخواست رد شد. دلیل: {r.rejectReason}</p>
      )}

      <RowsTable {...r} />
      {r.note && (
        <section className="flex flex-col gap-1">
          <h2 className="font-bold">توضیحات شما</h2>
          <p className="text-sm whitespace-pre-line">{r.note}</p>
        </section>
      )}
      <Messages messages={r.messages} viewer="shopper" />
      {canDo("shopperMessage", r.status) && <ShopperMessageForm requestId={r.id} />}
      <section className="text-muted-foreground flex flex-col gap-1 text-sm">
        <p>آدرس تحویل: {r.address}</p>
        <p>ثبت: {faDateTime(r.createdAt)}</p>
      </section>
      {r.status === "awaiting" && <CancelButton requestId={r.id} />}
    </div>
  );
}
