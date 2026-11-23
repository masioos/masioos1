"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveNoteAction, setQuantityAction, submitRequestAction } from "../actions";
import { maxQuantity, NOTE_MAX, type Unit } from "../rules";
import { fa, selectClass, textareaClass, UNIT_NAMES } from "./format";

/** Quantity picker for one cart line; saves on change. */
export function QuantitySelect({ productId, unit, quantity }: { productId: string; unit: Unit; quantity: number }) {
  return (
    <form action={setQuantityAction}>
      <input type="hidden" name="productId" value={productId} />
      <select
        name="quantity"
        aria-label="تعداد"
        defaultValue={String(quantity)}
        className={selectClass}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {Array.from({ length: maxQuantity(unit) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {fa(n)} {UNIT_NAMES[unit]}
          </option>
        ))}
      </select>
    </form>
  );
}

/**
 * The note box and «ثبت درخواست». Signed out: the note is saved and the shopper is sent to sign in.
 * Signed in: the address is asked for here (prefilled from the last request).
 */
export function SubmitForm({
  note,
  signedIn,
  lastAddress,
  blocked,
}: {
  note: string;
  signedIn: boolean;
  lastAddress: string;
  blocked: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitRequestAction, {});
  const [noteState, saveNote, savingNote] = useActionState(saveNoteAction, {});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef(note);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Saves the note by itself, so a shopper who forgets the button does not lose it. */
  function autoSave(text: string, delay: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (text === lastSaved.current) return;
      lastSaved.current = text;
      const fd = new FormData();
      fd.set("note", text);
      startTransition(() => saveNote(fd));
    }, delay);
  }

  return (
    <form key={state.attempt ?? 0} action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="note" className="block leading-7">
          <span className="font-bold">کالایی که در سایت نیست یا تعداد بیشتر</span>{" "}
          <span className="font-normal">
            (اگر کالایی رو در سایت پیدا نکردی یا تعداد بیشتری نیاز داشتی تو قسمت زیر برامون یادداشت بزار تا
            برات جورش کنیم)
          </span>
        </Label>
        <textarea
          id="note"
          name="note"
          defaultValue={note}
          onChange={(e) => autoSave(e.currentTarget.value, 1000)}
          onBlur={(e) => autoSave(e.currentTarget.value, 0)}
          maxLength={NOTE_MAX}
          rows={3}
          className={textareaClass}
          placeholder="مثال: لنت ترمز جلو سمند، ۶ جفت"
        />
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            formAction={(fd) => {
              clearTimeout(timer.current);
              lastSaved.current = String(fd.get("note") ?? "");
              saveNote(fd);
            }}
            size="sm"
            variant="outline"
            disabled={savingNote}
          >
            ذخیره‌ی توضیحات
          </Button>
          {savingNote && <span className="text-muted-foreground text-xs">در حال ذخیره…</span>}
          {noteState.ok && !savingNote && <span className="text-xs text-green-700">ذخیره شد</span>}
          {noteState.error && <span className="text-destructive text-xs">{noteState.error}</span>}
        </div>
      </div>
      {signedIn && (
        <div className="grid gap-1.5">
          <Label htmlFor="address">آدرس تحویل</Label>
          <textarea
            id="address"
            name="address"
            defaultValue={lastAddress}
            rows={2}
            required
            className={textareaClass}
            placeholder="شهر، خیابان، کوچه، پلاک، کد پستی"
          />
        </div>
      )}
      {blocked && <p className="text-destructive text-sm">{blocked}</p>}
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" disabled={pending || !!blocked} className="justify-self-start">
        {pending ? "در حال ثبت…" : signedIn ? "ثبت درخواست" : "ورود و ثبت درخواست"}
      </Button>
      <p className="text-muted-foreground text-xs">
        مشتری ارجمند سفارش شما بعد از ثبت، «در انتظار تأیید فروشگاه» خواهد بود. فاکتور نهایی بعد از تأیید مشخص
        می‌شود. باسپاس از یاری شما ...
      </p>
    </form>
  );
}
