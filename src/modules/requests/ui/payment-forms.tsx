"use client";

import { useActionState, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { CardInput } from "@/components/card-input";
import { PriceInput } from "@/components/price-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupCard } from "@/lib/card";
import { digitsOnly, groupAscii, groupFa } from "@/lib/money";
import {
  addRefundAction,
  confirmPaymentAction,
  type FormState,
  paymentNotFoundAction,
  sendPaymentAction,
  setDeliveryAction,
  setPayeeAction,
  shippedAction,
  shippingCodeAction,
  uploadReceiptAction,
  uploadRefundReceiptAction,
} from "../actions";
import { amountProblem, DELIVERY_NAMES, PAY_ON_DELIVERY_NOTE, type DeliveryMethod } from "../rules";
import { selectClass } from "./format";

// Payment forms (#19): the shopper's delivery choice and payment form; staff payee card, payment
// answers, shipping and refunds.

const bigChoice =
  "flex h-auto min-h-20 flex-1 flex-col items-center justify-center gap-1 whitespace-normal rounded-xl border-2 p-4 text-center";

/** Red buttons turn green once done: «before» is light red, «done» is green. */
const beforeButton = "border border-red-300 bg-red-100 text-red-900 hover:bg-red-200";
const doneButton = "border border-green-700 bg-green-600 text-white disabled:opacity-100";

/** The name of the box that changed inside a form. */
const nameOf = (t: EventTarget) => (t instanceof Element ? (t.getAttribute("name") ?? "") : "");

/** Boxes left empty (or wrong) when a form is sent blink red until they change. */
function useBlink() {
  const [bad, setBad] = useState<ReadonlySet<string>>(new Set());
  return {
    bad,
    mark: (names: string[]) => setBad(new Set(names)),
    clear: (name: string) =>
      setBad((s) => {
        if (!s.has(name)) return s;
        const next = new Set(s);
        next.delete(name);
        return next;
      }),
    cls: (name: string) => (bad.has(name) ? "blink-red" : ""),
  };
}

/** Shopper: the delivery method, asked once before «پرداخت با». Saves as soon as it is picked. */
export function DeliveryPicker({ requestId, current }: { requestId: string; current: DeliveryMethod | null }) {
  const [state, formAction, pending] = useActionState(setDeliveryAction, {});
  const [, startTransition] = useTransition();
  const [picked, setPicked] = useState<DeliveryMethod | null>(current);
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
      <input type="hidden" name="requestId" value={requestId} />
      <p className="font-bold">روش ارسال:</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(DELIVERY_NAMES) as DeliveryMethod[]).map((m) => (
          <label
            key={m}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2 text-sm ${picked === m ? "border-green-600 bg-green-100" : "bg-white"}`}
          >
            <input
              type="radio"
              name="deliveryMethod"
              value={m}
              checked={picked === m}
              className="size-4"
              onChange={(e) => {
                setPicked(m);
                const fd = new FormData(e.currentTarget.form ?? undefined);
                // Called directly (not as a form action) so React does not reset the choice.
                startTransition(() => formAction(fd));
              }}
            />
            {DELIVERY_NAMES[m]}
          </label>
        ))}
      </div>
      {pending && <span className="text-muted-foreground text-xs">در حال ذخیره…</span>}
      {state.error && !pending && <span className="text-destructive text-sm">{state.error}</span>}
      {!current && !picked && <span className="text-muted-foreground text-xs">اول روش ارسال را انتخاب کنید.</span>}
    </form>
  );
}

/**
 * Shopper: «پرداخت با:» gateway (with tax, «به‌زودی» until #20) or card transfer; then
 * «پرداخت از طریق:» one card or more than one; then the payment form.
 */
export function PaymentChooser({
  requestId,
  total,
  remaining,
  gateway,
  taxPercent,
  card,
  cardName,
  partial,
  dayOptions,
}: {
  requestId: string;
  total: number;
  remaining: number;
  gateway: number;
  taxPercent: number;
  card: string;
  cardName: string;
  /** Some of the total is already sent or confirmed: go straight to «another card». */
  partial: boolean;
  dayOptions: { value: number; label: string }[];
}) {
  const [method, setMethod] = useState<"card" | null>(partial ? "card" : null);
  const [cards, setCards] = useState<"one" | "many" | null>(partial ? "many" : null);
  return (
    <div className="flex flex-col gap-4">
      {!partial && (
        <div className="flex flex-col gap-2">
          <p className="font-bold">پرداخت با:</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" disabled className={`${bigChoice} cursor-not-allowed border-dashed opacity-60`}>
              <span className="text-base font-bold">درگاه پرداخت</span>
              <span>{groupFa(gateway)} تومان</span>
              <span className="text-xs">شامل {groupFa(taxPercent)}٪ مالیات و ارزش افزوده</span>
              <span className="rounded-full bg-amber-200 px-2 text-xs">به‌زودی</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("card")}
              aria-pressed={method === "card"}
              className={`${bigChoice} ${method === "card" ? "border-green-600 bg-green-100" : "bg-white hover:border-green-600"}`}
            >
              <span className="text-base font-bold">انتقال به کارت</span>
              <span>{groupFa(total)} تومان</span>
              <span className="text-xs">بدون مالیات و ارزش افزوده</span>
            </button>
          </div>
        </div>
      )}

      {method === "card" && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-sm">مبلغ را کارت به کارت کنید به:</p>
            <p className="flex flex-wrap items-center gap-2">
              <span dir="ltr" className="font-mono text-lg font-bold tracking-wide select-all">
                {groupCard(card)}
              </span>
              <span>به نام {cardName}</span>
            </p>
            <p className="text-sm">{PAY_ON_DELIVERY_NOTE}</p>
          </div>
          {!partial && (
            <div className="flex flex-col gap-2">
              <p className="font-bold">پرداخت از طریق:</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setCards("one")}
                  aria-pressed={cards === "one"}
                  className={`${bigChoice} min-h-14 ${cards === "one" ? "border-green-600 bg-green-100" : "bg-white hover:border-green-600"}`}
                >
                  <span className="font-bold">یک کارت</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCards("many")}
                  aria-pressed={cards === "many"}
                  className={`${bigChoice} min-h-14 ${cards === "many" ? "border-green-600 bg-green-100" : "bg-white hover:border-green-600"}`}
                >
                  <span className="font-bold">بیشتر از یک کارت</span>
                  <span className="text-xs">برای هر کارت یک فرم با مبلغ همان پرداخت</span>
                </button>
              </div>
            </div>
          )}
          {cards && (
            <PaymentForm requestId={requestId} payeeCard={card} many={cards === "many"} remaining={remaining} dayOptions={dayOptions} />
          )}
        </>
      )}
    </div>
  );
}

const two = (n: number) => groupFa(n).padStart(2, "۰");

/** The typed amount of one payment stays in this browser until it is sent (a page reload keeps it). */
const amountKey = (requestId: string) => `anb-pay-amount-${requestId}`;
const noSubscribe = () => () => {};
function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeStored(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Private window or blocked storage: the amount is just not remembered.
  }
}

/** Shopper: after card-to-card, tell the shop how it was paid. With several cards, one form per card. */
function PaymentForm({
  requestId,
  payeeCard,
  many,
  remaining,
  dayOptions,
}: {
  requestId: string;
  payeeCard: string;
  many: boolean;
  remaining: number;
  dayOptions: { value: number; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(sendPaymentAction, {});
  const v = state.values ?? {};
  const blink = useBlink();
  const stored = useSyncExternalStore(noSubscribe, () => readStored(amountKey(requestId)), () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const amount = typed ?? (v.amount || stored);
  const amountNumber = digitsOnly(amount) === "" ? null : Number(digitsOnly(amount));
  const amountError = many ? amountProblem(amountNumber, remaining) : null;
  const [missing, setMissing] = useState(false);

  return (
    <form
      key={state.attempt ?? 0}
      action={formAction}
      noValidate
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        const empty = ["tracking", "cardLast4", "paidHour", "paidMinute", ...(many ? ["amount"] : [])].filter(
          (k) => String(fd.get(k) ?? "").trim() === "",
        );
        if (amountError) empty.push("amount");
        if (empty.length > 0) {
          e.preventDefault();
          blink.mark(empty);
          setMissing(true);
          return;
        }
        setMissing(false);
        writeStored(amountKey(requestId), "");
      }}
      onChange={(e) => blink.clear(nameOf(e.target))}
      className="grid max-w-md gap-3 rounded-xl border bg-white p-4"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="payeeCard" value={payeeCard} />
      <h3 className="font-bold">{many ? "اطلاعات یکی از پرداخت‌ها" : "بعد از پرداخت، این فرم را پر کنید"}</h3>
      {many && (
        <div className="grid gap-1.5">
          <Label htmlFor="amount">مبلغ این پرداخت (تومان)</Label>
          <Input
            id="amount"
            name="amount"
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(e) => {
              const shown = groupAscii(digitsOnly(e.currentTarget.value));
              setTyped(shown);
              writeStored(amountKey(requestId), shown);
            }}
            aria-invalid={!!amountError}
            className={`w-44 ${amountError ? "blink-red" : blink.cls("amount")}`}
          />
          {amountError ? (
            <p role="alert" className="text-destructive text-xs">
              {amountError} (باقی‌مانده: {groupFa(remaining)} تومان)
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">باقی‌مانده: {groupFa(remaining)} تومان — مبلغ خودش ذخیره می‌شود.</p>
          )}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="tracking">شماره پیگیری پرداخت</Label>
        <Input id="tracking" name="tracking" dir="ltr" inputMode="numeric" defaultValue={v.tracking} className={blink.cls("tracking")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cardLast4">۴ رقم آخر کارتی که با آن پرداخت کردید</Label>
        <Input
          id="cardLast4"
          name="cardLast4"
          dir="ltr"
          inputMode="numeric"
          maxLength={4}
          className={`w-24 ${blink.cls("cardLast4")}`}
          defaultValue={v.cardLast4}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="paidDay">تاریخ و ساعت پرداخت</Label>
        <select id="paidDay" name="paidDay" defaultValue={v.paidDay ?? "0"} className={`${selectClass} w-full`}>
          {dayOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2" dir="ltr">
          <select name="paidHour" aria-label="ساعت" defaultValue={v.paidHour ?? ""} className={`${selectClass} w-20 ${blink.cls("paidHour")}`}>
            <option value="" disabled>
              ساعت
            </option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {two(h)}
              </option>
            ))}
          </select>
          <span>:</span>
          <select
            name="paidMinute"
            aria-label="دقیقه"
            defaultValue={v.paidMinute ?? ""}
            className={`${selectClass} w-20 ${blink.cls("paidMinute")}`}
          >
            <option value="" disabled>
              دقیقه
            </option>
            {Array.from({ length: 60 }, (_, m) => (
              <option key={m} value={m}>
                {two(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ReceiptPicker upload={(fd) => uploadReceiptAction(withRequest(fd, requestId))} saved={v.receiptFile} />
      {missing && blink.bad.size > 0 && (
        <p role="alert" className="text-destructive text-sm">
          جاهای قرمز را پر کنید.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "در حال فرستادن…" : "فرستادن اطلاعات پرداخت"}
      </Button>
    </form>
  );
}

function withRequest(fd: FormData, requestId: string): FormData {
  fd.set("requestId", requestId);
  return fd;
}

/** A receipt photo is saved the moment it is picked; the form only sends its name. */
function ReceiptPicker({
  upload,
  saved,
  label = "عکس رسید (اختیاری)",
}: {
  upload: (fd: FormData) => Promise<{ name?: string; error?: string }>;
  saved?: string;
  label?: string;
}) {
  const [name, setName] = useState(saved ?? "");
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <input type="hidden" name="receiptFile" value={name} />
      <Input
        type="file"
        aria-label={label}
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          setError(undefined);
          const fd = new FormData();
          fd.set("receipt", file);
          start(async () => {
            const res = await upload(fd);
            if (res.name) setName(res.name);
            else {
              setName("");
              setError(res.error);
            }
          });
        }}
      />
      {busy && <span className="text-muted-foreground text-xs">در حال ذخیره‌ی عکس…</span>}
      {!busy && name && <span className="text-xs text-green-700">✓ عکس رسید ذخیره شد</span>}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

/** Staff: one order step, optionally with text boxes (reason…). Empty boxes blink red. */
export function StepForm({
  requestId,
  action,
  label,
  fields = [],
  hidden = {},
  variant = "default",
}: {
  requestId: string;
  hidden?: Record<string, string>;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  fields?: { name: string; label: string; ltr?: boolean }[];
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const blink = useBlink();
  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        const empty = fields.map((f) => f.name).filter((k) => String(fd.get(k) ?? "").trim() === "");
        if (empty.length > 0) {
          e.preventDefault();
          blink.mark(empty);
        }
      }}
      onChange={(e) => blink.clear(nameOf(e.target))}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      {fields.map((f) => (
        <div key={f.name} className="grid gap-1">
          <Label htmlFor={`${f.name}-${label}`} className="text-xs">
            {f.label}
          </Label>
          <Input id={`${f.name}-${label}`} name={f.name} dir={f.ltr ? "ltr" : undefined} className={`w-56 ${blink.cls(f.name)}`} />
        </div>
      ))}
      <Button type="submit" variant={variant} disabled={pending}>
        {label}
      </Button>
      {state.error && <span className="text-destructive text-sm">{state.error}</span>}
    </form>
  );
}

/**
 * Staff: answer one waiting payment form. «پرداخت تأیید شد؟» is light red until pressed (then the
 * form shows green); «تراکنش درست نیست» opens a reason box the shopper will read.
 */
export function PaymentVerdict({ requestId, paymentId }: { requestId: string; paymentId: string }) {
  const [confirmState, confirmAction, confirming] = useActionState(confirmPaymentAction, {});
  const [wrongOpen, setWrongOpen] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={confirmAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="paymentId" value={paymentId} />
          <Button type="submit" disabled={confirming} className={confirming ? doneButton : beforeButton}>
            {confirming ? "✓ در حال تأیید…" : "پرداخت تأیید شد؟"}
          </Button>
        </form>
        <Button type="button" variant="outline" className="border-red-400 text-red-700" onClick={() => setWrongOpen((o) => !o)}>
          تراکنش درست نیست
        </Button>
        {confirmState.error && <span className="text-destructive text-sm">{confirmState.error}</span>}
      </div>
      {wrongOpen && (
        <StepForm
          requestId={requestId}
          hidden={{ paymentId }}
          action={paymentNotFoundAction}
          label="فرستادن به مشتری"
          variant="destructive"
          fields={[{ name: "reason", label: "چه چیزی درست نیست؟ (مشتری می‌بیند)" }]}
        />
      )}
    </div>
  );
}

/** A finished step shown as a green button that cannot be pressed again. */
export function DoneButton({ label }: { label: string }) {
  return (
    <Button type="button" disabled className={`w-fit ${doneButton}`}>
      ✓ {label}
    </Button>
  );
}

/**
 * Staff: the parcel tracking code (saves by itself while typed) and «ارسال شد», light red until
 * pressed and green after. The code can still be fixed after shipping.
 */
export function ShipForm({
  requestId,
  code,
  needsCode,
  canShipNow,
  shipped,
}: {
  requestId: string;
  code: string;
  needsCode: boolean;
  canShipNow: boolean;
  shipped: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(shippingCodeAction, {});
  const [shipState, shipAction, shipping] = useActionState(shippedAction, {});
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(code);
  const [blinking, setBlinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef(code);

  const save = (text: string) => {
    if (text.trim() === lastSaved.current.trim()) return;
    lastSaved.current = text;
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("code", text);
    startTransition(() => saveAction(fd));
  };

  return (
    <div className="flex flex-col gap-2">
      {needsCode && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor={`ship-code-${requestId}`} className="text-xs">
              کد رهگیری مرسوله
            </Label>
            <Input
              id={`ship-code-${requestId}`}
              dir="ltr"
              value={value}
              onChange={(e) => {
                const text = e.currentTarget.value;
                setValue(text);
                setBlinking(false);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => save(text), 800);
              }}
              onBlur={() => {
                clearTimeout(timer.current);
                save(value);
              }}
              className={`w-56 ${blinking ? "blink-red" : ""}`}
            />
          </div>
          {saving && <span className="text-muted-foreground text-xs">در حال ذخیره…</span>}
          {!saving && saveState.ok && <span className="text-xs text-green-700">✓ ذخیره شد</span>}
          {!saving && saveState.error && <span className="text-destructive text-xs">{saveState.error}</span>}
        </div>
      )}
      {shipped ? (
        <DoneButton label="ارسال شد" />
      ) : (
        <form
          action={shipAction}
          onSubmit={(e) => {
            if (needsCode && value.trim() === "") {
              e.preventDefault();
              setBlinking(true);
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="code" value={value} />
          <Button type="submit" disabled={!canShipNow || shipping} className={shipping ? doneButton : beforeButton}>
            {shipping ? "✓ در حال ثبت…" : "ارسال شد"}
          </Button>
          {!canShipNow && <span className="text-muted-foreground text-xs">اول «در حال جمع‌آوری» را بزنید.</span>}
          {blinking && <span className="text-destructive text-sm">کد رهگیری را بنویسید.</span>}
          {shipState.error && <span className="text-destructive text-sm">{shipState.error}</span>}
        </form>
      )}
    </div>
  );
}

/** Staff: record one money transfer back to the shopper, with its receipt photo. */
export function RefundForm({ requestId, left, open = false }: { requestId: string; left: number; open?: boolean }) {
  const [state, formAction, pending] = useActionState(addRefundAction, {});
  const blink = useBlink();
  const [shown, setShown] = useState(open);
  if (!shown) {
    return (
      <Button type="button" variant="outline" className="w-fit" onClick={() => setShown(true)}>
        ثبت برگشت پول به مشتری
      </Button>
    );
  }
  return (
    <form
      key={state.ok ? `done-${state.attempt}` : "form"}
      action={formAction}
      noValidate
      onSubmit={(e) => {
        const fd = new FormData(e.currentTarget);
        const empty = ["amount", "tracking"].filter((k) => String(fd.get(k) ?? "").trim() === "");
        if (empty.length > 0) {
          e.preventDefault();
          blink.mark(empty);
        }
      }}
      onChange={(e) => blink.clear(nameOf(e.target))}
      className="grid max-w-md gap-3 rounded-lg border bg-white p-3"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-sm font-bold">ثبت یک برگشت پول</p>
      <p className="text-muted-foreground text-xs">قابل برگشت: {groupFa(left)} تومان</p>
      <div className="grid gap-1">
        <Label htmlFor={`refund-amount-${requestId}`} className="text-xs">
          مبلغ (تومان)
        </Label>
        <PriceInput id={`refund-amount-${requestId}`} name="amount" className={`w-44 ${blink.cls("amount")}`} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`refund-tracking-${requestId}`} className="text-xs">
          شماره پیگیری
        </Label>
        <Input id={`refund-tracking-${requestId}`} name="tracking" dir="ltr" inputMode="numeric" className={`w-56 ${blink.cls("tracking")}`} />
      </div>
      <ReceiptPicker upload={uploadRefundReceiptAction} label="عکس رسید برای مشتری (اختیاری)" />
      {state.error && <span className="text-destructive text-sm">{state.error}</span>}
      {state.ok && !pending && <span className="text-xs text-green-700">✓ برگشت پول ثبت شد و مشتری می‌بیند</span>}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "در حال ثبت…" : "ثبت برگشت پول"}
      </Button>
    </form>
  );
}

/** Staff: the payee card — one of the warehouses' cards, or another card typed by hand. */
export function PayeeForm({
  requestId,
  cards,
}: {
  requestId: string;
  cards: { id: string; name: string; cardNumber: string; cardHolder: string }[];
}) {
  const [state, formAction, pending] = useActionState(setPayeeAction, {});
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<"warehouse" | "other">("warehouse");
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef("");

  /**
   * Saves by itself (no button): a picked warehouse at once; a typed card once it has 16 digits and
   * a name, after a short pause in typing. The same card is never sent twice in a row.
   */
  const save = () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const card = String(fd.get("cardNumber") ?? "").replace(/\D/g, "");
    const name = String(fd.get("cardHolder") ?? "").trim();
    const ready = fd.get("mode") === "warehouse" ? !!fd.get("warehouseId") : card.length === 16 && name.length >= 3;
    const key = `${fd.get("mode")}|${fd.get("warehouseId") ?? ""}|${card}|${name}`;
    if (!ready || key === lastSaved.current) return;
    lastSaved.current = key;
    // Called directly (not as a form action) so React does not empty the boxes after saving.
    startTransition(() => formAction(fd));
  };
  const later = (ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(save, ms);
  };

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onChange={(e) => later(e.target instanceof HTMLSelectElement ? 0 : 900)}
      onBlur={() => later(0)}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="warehouse" checked={mode === "warehouse"} onChange={() => setMode("warehouse")} />
          کارت یکی از انبارها
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="mode" value="other" checked={mode === "other"} onChange={() => setMode("other")} />
          کارت دیگر
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {mode === "warehouse" ? (
          <select name="warehouseId" aria-label="انبار" className={`${selectClass} w-72`} defaultValue="">
            <option value="" disabled>
              انتخاب انبار…
            </option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.cardHolder}
              </option>
            ))}
          </select>
        ) : (
          <>
            <CardInput name="cardNumber" aria-label="شماره کارت ۱۶ رقمی" className="w-60" />
            <Input name="cardHolder" aria-label="نام صاحب کارت" placeholder="نام صاحب کارت" className="w-44" />
          </>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {mode === "warehouse"
          ? "با انتخاب انبار، کارت مقصد خودش عوض می‌شود."
          : "وقتی ۱۶ رقم کارت و نام صاحب کارت را نوشتید، خودش ذخیره می‌شود."}
      </p>
      {pending && <span className="text-muted-foreground text-xs">در حال ذخیره…</span>}
      {state.error && !pending && <span className="text-destructive text-sm">{state.error}</span>}
      {state.ok && !pending && <span className="text-xs text-green-700">✓ کارت مقصد عوض شد</span>}
    </form>
  );
}
