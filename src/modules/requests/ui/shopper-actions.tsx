"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  acceptRequestAction,
  cancelRequestAction,
  declineRequestAction,
  shopperMessageAction,
  type FormState,
} from "../actions";
import { textareaClass } from "./format";

function StepButton({
  requestId,
  action,
  label,
  variant = "default",
  deadlineSeen,
}: {
  requestId: string;
  deadlineSeen?: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      {deadlineSeen && <input type="hidden" name="deadlineSeen" value={deadlineSeen} />}
      <Button type="submit" variant={variant} disabled={pending}>
        {label}
      </Button>
      {state.error && <span className="text-destructive text-sm">{state.error}</span>}
    </form>
  );
}

export function CancelButton({ requestId }: { requestId: string }) {
  return <StepButton requestId={requestId} action={cancelRequestAction} label="لغو درخواست" variant="destructive" />;
}

/** `deadlineSeen`: the deadline of the invoice on screen; the server refuses if staff re-confirmed since. */
export function AcceptDeclineButtons({ requestId, deadlineSeen }: { requestId: string; deadlineSeen: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <StepButton requestId={requestId} deadlineSeen={deadlineSeen} action={acceptRequestAction} label="قبول" />
      <StepButton
        requestId={requestId}
        deadlineSeen={deadlineSeen}
        action={declineRequestAction}
        label="انصراف"
        variant="outline"
      />
    </div>
  );
}

/** The shopper writes to the shop on this request. */
export function ShopperMessageForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(shopperMessageAction, {});
  return (
    <form key={state.ok ? state.attempt : "keep"} action={formAction} className="grid gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="shopper-message" className="text-sm font-medium">
        پیام برای فروشگاه
      </label>
      <textarea id="shopper-message" name="message" rows={2} maxLength={2000} required className={textareaClass} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "در حال فرستادن…" : "فرستادن پیام"}
        </Button>
        {state.error && <span className="text-destructive text-sm">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-green-700">فرستاده شد</span>}
      </div>
    </form>
  );
}
