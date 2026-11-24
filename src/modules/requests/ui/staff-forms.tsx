"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PriceInput } from "@/components/price-input";
import { digitsOnly, groupAscii } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  addRowAction,
  confirmRequestAction,
  editRowAction,
  invoiceDiscountAction,
  rejectRequestAction,
  reopenRequestAction,
  sendMessageAction,
  type FormState,
} from "../actions";
import { DEFAULT_DEADLINE_HOURS, MAX_DEADLINE_HOURS, rowTotal, type DiscountKind, type Unit } from "../rules";
import { fa, selectClass, textareaClass, toman, UNIT_NAMES } from "./format";
import { ProfitCell, profitCellClass } from "./request-view";

function Status({ state, pending, ok = "ذخیره شد" }: { state: FormState; pending: boolean; ok?: string }) {
  if (state.error) return <span className="text-destructive text-sm">{state.error}</span>;
  if (state.ok && !pending) return <span className="text-sm text-green-700">{ok}</span>;
  return null;
}

/**
 * One editable row of the staff table (only while the request awaits confirmation).
 * A <form> cannot wrap a table row, so the inputs join the form in the last cell by its id.
 * Changes save by themselves: a checkbox at once, typed values a moment after typing stops or when
 * the box is left. The action is called directly (not as the form's action) so React does not
 * reset the boxes while staff are still typing in them.
 */
export function RowEditForm({
  index,
  rowId,
  name,
  code,
  unit,
  price,
  quantity,
  discountPercent,
  isUnavailable,
  warehouse,
  purchasePrice,
  manualProfit,
}: {
  index: number;
  rowId: string;
  name: string;
  code: string | null;
  unit: Unit;
  price: number | null;
  quantity: number;
  discountPercent: number;
  isUnavailable: boolean;
  warehouse: string;
  purchasePrice: number | null;
  manualProfit: number | null;
}) {
  const [state, formAction, pending] = useActionState(editRowAction, {});
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef("");
  const formId = `row-${rowId}`;

  const snapshot = () => {
    const form = formRef.current;
    if (!form) return "";
    return [...new FormData(form).entries()].map(([k, v]) => `${k}=${String(v)}`).join("&");
  };
  useEffect(() => {
    lastSent.current = snapshot();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    const now = snapshot();
    if (!form || now === lastSent.current) return;
    lastSent.current = now;
    const fd = new FormData(form);
    startTransition(() => formAction(fd));
  };
  const saveSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  };

  const live = price !== null && !isUnavailable;
  return (
    <TableRow
      className={isUnavailable ? "bg-muted/40 text-muted-foreground" : ""}
      onChange={(e) => (e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? save() : saveSoon())}
      onBlur={save}
    >
      <TableCell className="text-center">{fa(index)}</TableCell>
      <TableCell className="max-w-64 whitespace-normal">
        <span className="font-medium">{name}</span>
        {code && (
          <span className="text-muted-foreground block text-end text-xs" dir="ltr">
            {code}
          </span>
        )}
        <span className="text-muted-foreground block text-xs">انبار: {warehouse || "—"}</span>
      </TableCell>
      <TableCell>
        <PriceInput form={formId} name="priceToman" defaultValue={price} aria-label="قیمت واحد" className="w-32" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            form={formId}
            name="quantity"
            defaultValue={quantity}
            dir="ltr"
            className="w-16"
            inputMode="numeric"
            aria-label="تعداد"
            required
          />
          <span className="text-xs">{UNIT_NAMES[unit]}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            form={formId}
            name="discountPercent"
            defaultValue={discountPercent}
            dir="ltr"
            className="w-14"
            inputMode="numeric"
            aria-label="درصد تخفیف"
          />
          <span className="text-xs">٪</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <input form={formId} type="checkbox" name="isUnavailable" defaultChecked={isUnavailable} aria-label="ناموجود" />
      </TableCell>
      <TableCell>
        {live ? toman(rowTotal({ priceToman: price, quantity, discountPercent })) : "—"}
        {live && discountPercent > 0 && (
          <span className="text-muted-foreground block text-xs line-through">{toman(price * quantity)}</span>
        )}
      </TableCell>
      <TableCell className="w-28">
        <form
          id={formId}
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input type="hidden" name="rowId" value={rowId} />
          {pending ? (
            <span className="text-muted-foreground text-xs">در حال ذخیره…</span>
          ) : state.error ? (
            <span className="text-destructive text-xs">{state.error}</span>
          ) : state.ok ? (
            <span className="text-xs text-green-700">ذخیره شد</span>
          ) : null}
        </form>
      </TableCell>
      {purchasePrice === null ? (
        // A free row has no purchase price: staff type its profit (saves like the other boxes).
        <TableCell className={profitCellClass}>
          <div className="flex items-center gap-1">
            <PriceInput
              form={formId}
              name="manualProfitToman"
              allowNegative
              defaultValue={manualProfit}
              aria-label="پرافیت این ردیف"
              placeholder="پرافیت"
              className="w-28"
            />
            <span className="text-xs">تومان</span>
          </div>
        </TableCell>
      ) : (
        <ProfitCell row={{ priceToman: price, quantity, discountPercent, isUnavailable, purchasePriceToman: purchasePrice }} />
      )}
    </TableRow>
  );
}

export function AddRowForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(addRowAction, {});
  return (
    <form
      key={state.ok ? state.attempt : "keep"}
      action={formAction}
      className="bg-muted/30 flex flex-wrap items-end gap-3 rounded-xl border border-dashed p-3"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <p className="w-full text-sm font-bold">افزودن ردیف</p>
      <label className="grid gap-1 text-xs">
        کد فنی (از کالاهای سایت)
        <Input name="code" dir="ltr" className="w-40" />
      </label>
      <span className="pb-2 text-sm">یا</span>
      <label className="grid gap-1 text-xs">
        نام ردیف دلخواه
        <Input name="name" className="w-56" />
      </label>
      <label className="grid gap-1 text-xs">
        قیمت واحد (تومان)
        <PriceInput name="priceToman" className="w-36" />
      </label>
      <label className="grid gap-1 text-xs">
        تعداد
        <Input name="quantity" dir="ltr" className="w-20" inputMode="numeric" defaultValue="1" />
      </label>
      <label className="grid gap-1 text-xs">
        واحد (ردیف دلخواه)
        <select name="unit" defaultValue="piece" className={selectClass}>
          <option value="piece">عدد</option>
          <option value="pair">جفت</option>
        </select>
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        افزودن ردیف
      </Button>
      <Status state={state} pending={pending} ok="اضافه شد" />
    </form>
  );
}

/**
 * One message box for every staff step, so nothing typed is lost:
 * «فرستادن پیام» sends it alone, «تأیید» sends it with the confirmation, «رد» uses it as the reason.
 */
export function StaffActions({
  requestId,
  canConfirm,
  canReject,
}: {
  requestId: string;
  canConfirm: boolean;
  canReject: boolean;
}) {
  const [msg, sendMsg, sending] = useActionState(sendMessageAction, {});
  const [conf, confirm, confirming] = useActionState(confirmRequestAction, {});
  const [rej, reject, rejecting] = useActionState(rejectRequestAction, {});
  const pending = sending || confirming || rejecting;
  // Clear the box only after a step succeeded; an error keeps what was typed.
  const doneKey = `${msg.ok ? msg.attempt : 0}-${conf.ok ? conf.attempt : 0}-${rej.ok ? rej.attempt : 0}`;
  // Only the result of the button pressed last is shown.
  const [last, setLast] = useState<"msg" | "conf" | "rej">("msg");
  const shown = { msg, conf, rej }[last];
  const done = { msg: "پیام فرستاده شد", conf: "تأیید شد", rej: "رد شد" }[last];

  return (
    <form key={doneKey} action={sendMsg} className="grid gap-3 rounded-xl border p-4">
      <input type="hidden" name="requestId" value={requestId} />
      <Label htmlFor="message" className="font-bold">
        پیام برای مشتری
      </Label>
      <textarea
        id="message"
        name="message"
        rows={3}
        maxLength={2000}
        className={textareaClass}
        placeholder="اگر «تأیید» یا «رد» را بزنید، این پیام هم همراهش فرستاده می‌شود."
      />
      {canConfirm && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          مهلت پاسخ مشتری
          <Input name="hours" dir="ltr" className="w-20" inputMode="numeric" placeholder={String(DEFAULT_DEADLINE_HOURS)} />
          ساعت (خالی = {fa(DEFAULT_DEADLINE_HOURS)} ساعت، حداکثر {fa(MAX_DEADLINE_HOURS)})
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" disabled={pending} onClick={() => setLast("msg")}>
          فرستادن پیام
        </Button>
        {canConfirm && (
          <Button type="submit" formAction={confirm} disabled={pending} onClick={() => setLast("conf")} className="bg-green-700 hover:bg-green-800">
            تأیید و فرستادن برای مشتری
          </Button>
        )}
        {canReject && (
          <Button type="submit" formAction={reject} variant="destructive" disabled={pending} onClick={() => setLast("rej")}>
            رد درخواست
          </Button>
        )}
      </div>
      {!pending && shown.error && <p className="text-destructive text-sm">{shown.error}</p>}
      {!pending && shown.ok && <p className="text-sm text-green-700">{done}</p>}
      {canReject && <p className="text-muted-foreground text-xs">برای «رد درخواست»، دلیل را در همین کادر بنویسید.</p>}
    </form>
  );
}

/** «ویرایش فاکتور» on a confirmed or accepted request: it goes back to awaiting confirmation. */
export function ReopenForm({ requestId, accepted }: { requestId: string; accepted: boolean }) {
  const [state, formAction, pending] = useActionState(reopenRequestAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" variant="outline" disabled={pending}>
        ویرایش فاکتور
      </Button>
      <p className="text-muted-foreground text-xs">
        درخواست به «در انتظار تأیید» برمی‌گردد{accepted ? " و پذیرش مشتری برداشته می‌شود" : ""}. بعد از ویرایش دوباره
        «تأیید» بزنید تا مشتری فاکتور تازه را ببیند و بپذیرد.
      </p>
      {state.error && <p className="text-destructive w-full text-sm">{state.error}</p>}
    </form>
  );
}

/**
 * The «تخفیف» box beside the invoice total. Ticked, it offers a percent or an amount in Toman.
 * Every change saves by itself a moment later (no button).
 */
export function InvoiceDiscountForm({ requestId, kind, value }: { requestId: string; kind: DiscountKind; value: number }) {
  const [state, action, pending] = useActionState(invoiceDiscountAction, {});
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(kind !== "none");
  const [mode, setMode] = useState<"percent" | "amount">(kind === "amount" ? "amount" : "percent");
  const [text, setText] = useState(kind === "none" ? "" : String(value));
  const lastSent = useRef(`${kind !== "none"}|${kind === "amount" ? "amount" : "percent"}|${kind === "none" ? "" : value}`);

  // Sends what is on screen unless it was already sent.
  const flush = useCallback(() => {
    const now = `${enabled}|${mode}|${text}`;
    if (now === lastSent.current) return;
    lastSent.current = now;
    const fd = new FormData();
    fd.set("requestId", requestId);
    if (enabled) fd.set("enabled", "on");
    fd.set("kind", mode);
    fd.set("value", text);
    startTransition(() => action(fd));
  }, [enabled, mode, text, requestId, action]);

  useEffect(() => {
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [flush]);

  const name = `discount-${requestId}`;
  // Leaving the box (for example to press «تأیید») saves at once, before the next button's action.
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm font-normal" onBlur={flush}>
      <label className="flex items-center gap-1.5 font-bold">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} className="size-4" />
        تخفیف
      </label>
      {enabled && (
        <>
          <label className="flex items-center gap-1">
            <input type="radio" name={name} checked={mode === "percent"} onChange={() => {
                setMode("percent");
                setText("");
              }}
            />
            درصدی
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name={name} checked={mode === "amount"} onChange={() => {
                setMode("amount");
                setText("");
              }}
            />
            مبلغی
          </label>
          <span className="flex items-center gap-1">
            <Input
              value={mode === "amount" ? groupAscii(text) : text}
              onChange={(e) => setText(digitsOnly(e.currentTarget.value))}
              dir="ltr"
              inputMode="numeric"
              className={mode === "amount" ? "w-32" : "w-16"}
              aria-label={mode === "amount" ? "مبلغ تخفیف به تومان" : "درصد تخفیف فاکتور"}
            />
            <span className="text-xs">{mode === "amount" ? "تومان" : "٪"}</span>
          </span>
        </>
      )}
      {pending ? (
        <span className="text-muted-foreground text-xs">در حال ذخیره…</span>
      ) : state.error ? (
        <span className="text-destructive text-xs">{state.error}</span>
      ) : state.ok ? (
        <span className="text-xs text-green-700">ذخیره شد</span>
      ) : null}
    </div>
  );
}
