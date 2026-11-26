import { groupCard } from "@/lib/card";
import { faDateTime } from "@/lib/date";
import { collectingAction, refundAction } from "../actions";
import { getGatewayTaxPercent } from "@/modules/settings";
import {
  beforePayment,
  canCancelOrder,
  canDo,
  DELIVERY_NAMES,
  gatewayAmount,
  needsTrackingCode,
  PAY_ON_DELIVERY_NOTE,
  paymentDayOptions,
  paymentProgress,
  refundable,
  type Status,
} from "../rules";
import type { PaymentView, RefundView } from "../service";
import { toman } from "./format";
import { DeliveryPicker, DoneButton, PayeeForm, PaymentChooser, PaymentVerdict, RefundForm, ShipForm, StepForm } from "./payment-forms";

// The payment part of a request page (#19), for the shopper and for staff.

type OrderInfo = {
  id: string;
  status: Status;
  total: number;
  deadlineAt: Date | null;
  payeeCard: string | null;
  payeeName: string | null;
  paymentFormAt: Date | null;
  deliveryMethod: keyof typeof DELIVERY_NAMES | null;
  shippingCode: string;
  refundReason: string;
  refundTracking: string;
  payments: PaymentView[];
  refunds: RefundView[];
};

function Card({ card, name }: { card: string | null; name: string | null }) {
  if (!card) return <p className="text-sm">کارت مقصد هنوز مشخص نشده است.</p>;
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span dir="ltr" className="font-mono text-lg font-bold tracking-wide select-all">
        {groupCard(card)}
      </span>
      <span>به نام {name}</span>
    </p>
  );
}

function Delivery({ r, code = true }: { r: Pick<OrderInfo, "deliveryMethod" | "shippingCode">; code?: boolean }) {
  if (!r.deliveryMethod) return null;
  return (
    <p className="text-sm">
      روش ارسال: {DELIVERY_NAMES[r.deliveryMethod]}
      {code && r.shippingCode && (
        <>
          {" "}
          — کد رهگیری: <span dir="ltr" className="font-bold select-all">{r.shippingCode}</span>
        </>
      )}
    </p>
  );
}

const VERDICT_FOR_SHOPPER = { pending: "در انتظار بررسی", confirmed: "تأیید شد", not_found: "تأیید نشد" } as const;

/** Money sent back to the shopper, with the receipt photos staff sent. Shown to both sides. */
function Refunds({ refunds, staff = false }: { refunds: (RefundView & { createdByName?: string })[]; staff?: boolean }) {
  if (refunds.length === 0) return null;
  const sum = refunds.reduce((t, x) => t + x.amountToman, 0);
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white/70 p-3 text-sm">
      <p className="font-bold">برگشت پول ({toman(sum)})</p>
      <ul className="flex flex-col gap-1">
        {refunds.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-x-2">
            <span>{toman(x.amountToman)}</span>
            <span>
              — شماره پیگیری <span dir="ltr" className="select-all">{x.tracking}</span>
            </span>
            <span>— {faDateTime(x.createdAt)}</span>
            {staff && x.createdByName && <span className="text-muted-foreground">— {x.createdByName}</span>}
            {x.receiptFile && (
              <a href={`/requests/refund-receipts/${x.receiptFile}`} target="_blank" rel="noreferrer" className="text-primary underline">
                دیدن عکس رسید
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shopper: what to pay and where, the payment form, then where the order is. */
export async function ShopperPayment({ r }: { r: OrderInfo }) {
  const last = r.payments[0];
  const progress = paymentProgress(r.total, r.payments);
  const canPay = canDo("pay", r.status) && progress.remaining > 0;
  if (canPay) {
    const taxPercent = await getGatewayTaxPercent();
    const partial = r.payments.some((p) => p.verdict !== "not_found");
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <h2 className="text-lg font-bold">پرداخت</h2>
        <p>
          مبلغ فاکتور: <span className="text-lg font-bold">{toman(r.total)}</span>
        </p>
        {r.payments.length > 0 && (
          <div className="flex flex-col gap-1 rounded-lg bg-white/70 p-3 text-sm">
            <p className="font-medium">پرداخت‌های شما</p>
            <ul className="flex flex-col gap-0.5">
              {r.payments.map((p) => (
                <li key={p.id}>
                  {toman(p.amountToman)} — شماره پیگیری <span dir="ltr">{p.tracking}</span> — {VERDICT_FOR_SHOPPER[p.verdict]}
                </li>
              ))}
            </ul>
            <p>
              تأیید شده: {toman(progress.confirmed)} — در انتظار بررسی: {toman(progress.pending)} —{" "}
              <span className="font-bold">باقی‌مانده: {toman(progress.remaining)}</span>
            </p>
          </div>
        )}
        <Refunds refunds={r.refunds} />
        {last?.verdict === "not_found" && (
          <p className="bg-destructive/5 text-destructive rounded-lg p-3 text-sm">
            پرداخت {toman(last.amountToman)} شما تأیید نشد: {last.verdictReason}. لطفاً فرم را درست کنید و دوباره بفرستید.
          </p>
        )}
        {r.deadlineAt && !r.paymentFormAt && <p className="text-sm">مهلت پرداخت: {faDateTime(r.deadlineAt)}</p>}
        <DeliveryPicker requestId={r.id} current={r.deliveryMethod} />
        {!r.deliveryMethod ? null : r.payeeCard && r.payeeName ? (
          <PaymentChooser
            requestId={r.id}
            total={r.total}
            remaining={progress.remaining}
            gateway={gatewayAmount(r.total, taxPercent)}
            taxPercent={taxPercent}
            card={r.payeeCard}
            cardName={r.payeeName}
            partial={partial}
            dayOptions={paymentDayOptions(new Date())}
          />
        ) : (
          <p className="text-sm">کارت مقصد هنوز مشخص نشده است. به‌زودی اینجا نشان داده می‌شود.</p>
        )}
      </section>
    );
  }
  const box = "flex flex-col gap-2 rounded-xl border p-4";
  if (r.status === "payment_sent") {
    return (
      <section className={`${box} border-violet-200 bg-violet-50`}>
        <p>اطلاعات پرداخت شما رسید و در حال بررسی است.</p>
        <ul className="flex flex-col gap-0.5 text-sm">
          {r.payments.map((p) => (
            <li key={p.id}>
              {toman(p.amountToman)} — شماره پیگیری <span dir="ltr">{p.tracking}</span> — {faDateTime(p.paidAt)} —{" "}
              {VERDICT_FOR_SHOPPER[p.verdict]}
            </li>
          ))}
        </ul>
        <Delivery r={r} code={false} />
        <Refunds refunds={r.refunds} />
      </section>
    );
  }
  if (r.status === "paid" || r.status === "collecting" || r.status === "shipped") {
    const text = {
      paid: "پرداخت شما تأیید شد. سفارش به‌زودی جمع‌آوری می‌شود.",
      collecting: "سفارش شما در حال جمع‌آوری است.",
      shipped: "سفارش شما ارسال شد.",
    }[r.status];
    return (
      <section className={`${box} border-green-200 bg-green-50`}>
        <p>{text}</p>
        <Delivery r={r} code={r.status === "shipped"} />
        {r.status === "shipped" && <p className="text-sm">{PAY_ON_DELIVERY_NOTE}</p>}
        <Refunds refunds={r.refunds} />
      </section>
    );
  }
  if (r.status === "refunded") {
    return (
      <section className={`${box} border-destructive/30 bg-destructive/5`}>
        <p>این سفارش لغو شد و مبلغ آن به شما برگردانده می‌شود.</p>
        <p className="text-sm">دلیل: {r.refundReason}</p>
        {r.refundTracking && (
          <p className="text-sm">
            شماره پیگیری برگشت پول: <span dir="ltr">{r.refundTracking}</span>
          </p>
        )}
        <Refunds refunds={r.refunds} />
      </section>
    );
  }
  return null;
}

/** Staff: payee card, payment forms with receipts, and the next order step. */
export function StaffPayment({
  r,
  cards,
}: {
  r: Omit<OrderInfo, "payments" | "refunds"> & {
    payments: (PaymentView & { decidedByName: string })[];
    refunds: (RefundView & { createdByName: string })[];
  };
  cards: { id: string; name: string; cardNumber: string; cardHolder: string }[];
}) {
  const payeeOpen = canDo("setPayee", r.status) && beforePayment(r);
  const afterAccept = !["awaiting", "confirmed", "cancelled", "rejected", "declined"].includes(r.status);
  if (!payeeOpen && !afterAccept && !r.payeeCard) return null;
  const progress = paymentProgress(r.total, r.payments);
  const refundLeft = refundable(progress.confirmed, r.refunds);
  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <h2 className="text-lg font-bold">پرداخت و سفارش</h2>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">کارت مقصد (مبلغ {toman(r.total)})</p>
        <Card card={r.payeeCard} name={r.payeeName} />
        {payeeOpen && <PayeeForm requestId={r.id} cards={cards} />}
      </div>
      <Delivery r={r} code={false} />

      {r.payments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">فرم‌های پرداخت</h3>
          <p className="text-sm">
            تأیید شده: {toman(progress.confirmed)} — در انتظار بررسی: {toman(progress.pending)} — باقی‌مانده:{" "}
            {toman(progress.remaining)}
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {r.payments.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                <p>
                  {toman(p.amountToman)} به کارت <span dir="ltr">{groupCard(p.payeeCard)}</span> ({p.payeeName})
                </p>
                <p>
                  شماره پیگیری: <span dir="ltr" className="font-bold select-all">{p.tracking}</span> — ۴ رقم آخر کارت مشتری:{" "}
                  <span dir="ltr">{p.cardLast4}</span> — زمان پرداخت: {faDateTime(p.paidAt)}
                </p>
                {p.receiptFile && (
                  <a href={`/admin/receipts/${p.receiptFile}`} target="_blank" rel="noreferrer" className="text-primary underline">
                    دیدن عکس رسید
                  </a>
                )}
                {p.verdict !== "pending" && (
                  <p className="text-muted-foreground">
                    {p.decidedByName}
                    {p.decidedAt && ` — ${faDateTime(p.decidedAt)}`}
                  </p>
                )}
                {p.verdict === "pending" && canDo("confirmPayment", r.status) && <PaymentVerdict requestId={r.id} paymentId={p.id} />}
                {p.verdict === "confirmed" && (
                  <div className="mt-2">
                    <DoneButton label="پرداخت تأیید شد" />
                  </div>
                )}
                {p.verdict === "not_found" && (
                  <p className="mt-2 w-fit rounded-md border border-red-300 bg-red-100 px-3 py-1.5 text-red-900">
                    ✗ تراکنش درست نبود: {p.verdictReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {canDo("collect", r.status) && <StepForm requestId={r.id} action={collectingAction} label="در حال جمع‌آوری" />}
        {canDo("shippingCode", r.status) && (
          <ShipForm
            requestId={r.id}
            code={r.shippingCode}
            needsCode={needsTrackingCode(r.deliveryMethod)}
            canShipNow={canDo("ship", r.status)}
            shipped={r.status === "shipped"}
          />
        )}
        {canCancelOrder(r.status, r.paymentFormAt) && (
          <StepForm
            requestId={r.id}
            action={refundAction}
            label="لغو و برگشت پول"
            variant="destructive"
            fields={[{ name: "reason", label: "دلیل لغو (مشتری می‌بیند)" }]}
          />
        )}
        {r.status === "refunded" && (
          <p className="text-sm">
            لغو و برگشت پول — دلیل: {r.refundReason}
            {r.refundTracking && (
              <>
                {" "}
                — شماره پیگیری: <span dir="ltr">{r.refundTracking}</span>
              </>
            )}
          </p>
        )}
      </div>

      {(r.refunds.length > 0 || (canDo("addRefund", r.status) && progress.confirmed > 0)) && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <h3 className="font-bold">برگشت پول به مشتری</h3>
          <p className="text-sm">
            پرداخت تأیید شده: {toman(progress.confirmed)} — برگشت داده شده: {toman(progress.confirmed - refundLeft)} — قابل برگشت:{" "}
            {toman(refundLeft)}
          </p>
          <Refunds refunds={r.refunds} staff />
          {canDo("addRefund", r.status) && refundLeft > 0 && <RefundForm requestId={r.id} left={refundLeft} open={r.status === "refunded"} />}
        </div>
      )}
    </section>
  );
}
