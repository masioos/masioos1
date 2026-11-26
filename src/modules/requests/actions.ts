"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addressSchema, getCurrentCustomer } from "@/modules/customers";
import { canSee, requireStaff, type CurrentStaff } from "@/modules/staff";
import {
  payeeSchema,
  paymentFormSchema,
  paymentVerdictSchema,
  refundSchema,
  shipSchema,
  addRefundSchema,
  deliverySchema,
  shippingCodeSchema,
  addRowSchema,
  confirmSchema,
  invoiceDiscountSchema,
  messageSchema,
  noteSchema,
  rejectSchema,
  requestIdSchema,
  rowEditSchema,
} from "./rules";
import {
  acceptRequest,
  addRow,
  addToCart,
  cancelRequest,
  confirmRequest,
  declineRequest,
  editRow,
  rejectRequest,
  removeFromCart,
  reopenRequest,
  sendMessage,
  sendShopperMessage,
  setInvoiceDiscount,
  setCartNote,
  setCartQuantity,
  myUnseenCount,
  staffAlertCounts,
  submitRequest,
  confirmPayment,
  markCollecting,
  markShipped,
  paymentNotFound,
  refundOrder,
  sendPayment,
  setPayee,
  uploadReceipt,
  addRefund,
  saveShippingCode,
  setDelivery,
  uploadRefundReceipt,
} from "./service";

// Server actions of the requests module. Every input is validated here with zod.
// Staff actions go through `staffStep` (requireStaff); shopper actions use the shopper session.

export type FormState = { error?: string; ok?: boolean; attempt?: number; values?: Record<string, string> };

const refresh = () => revalidatePath("/", "layout");
const first = (e: z.ZodError) => e.issues[0]?.message ?? "اطلاعات فرم درست نیست";
const fail = (prev: FormState, error: string): FormState => ({ error, attempt: (prev.attempt ?? 0) + 1 });

// ── Cart ───────────────────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export async function addToCartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "تعداد درست نیست" };
  const res = await addToCart(parsed.data.productId, parsed.data.quantity);
  if (!res.ok) return { error: res.error };
  refresh();
  return { ok: true };
}

export async function setQuantityAction(formData: FormData): Promise<void> {
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setCartQuantity(parsed.data.productId, parsed.data.quantity);
  refresh();
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("productId"));
  if (!id.success) return;
  await removeFromCart(id.data);
  refresh();
}

export async function saveNoteAction(prev: FormState, formData: FormData): Promise<FormState> {
  const note = noteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return fail(prev, first(note.error));
  await setCartNote(note.data);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

/** «ثبت درخواست»: needs a signed-in shopper and an address. Saves the note first. */
export async function submitRequestAction(prev: FormState, formData: FormData): Promise<FormState> {
  const note = noteSchema.safeParse(formData.get("note") ?? "");
  if (!note.success) return fail(prev, first(note.error));
  await setCartNote(note.data);
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login?next=/cart");
  const address = addressSchema.safeParse(formData.get("address") ?? "");
  if (!address.success) return fail(prev, first(address.error));
  const res = await submitRequest(customer.id, address.data);
  if (!res.ok) return fail(prev, res.error);
  refresh();
  redirect(`/requests/${res.id}?sent=1`);
}

// ── Shopper on a request ───────────────────────────────────────────────────────────────

const idSchema = z.object({ requestId: z.uuid() });

async function shopperStep(
  prev: FormState,
  formData: FormData,
  step: (customerId: string, id: string) => Promise<{ ok: true } | { ok: false; error: string }>,
): Promise<FormState> {
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  const customer = await getCurrentCustomer();
  if (!parsed.success || !customer) return fail(prev, "درخواست پیدا نشد");
  const res = await step(customer.id, parsed.data.requestId);
  if (!res.ok) return fail(prev, res.error);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

export async function cancelRequestAction(prev: FormState, formData: FormData) {
  return shopperStep(prev, formData, cancelRequest);
}
const answerSchema = z.object({ requestId: z.uuid(), deadlineSeen: z.iso.datetime() });

/** Accept / decline name the invoice the shopper saw (its deadline), so a re-confirmed one is not answered blind. */
async function answerStep(
  prev: FormState,
  formData: FormData,
  step: (customerId: string, id: string, deadlineSeen: Date) => Promise<{ ok: true } | { ok: false; error: string }>,
): Promise<FormState> {
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  const customer = await getCurrentCustomer();
  if (!parsed.success || !customer) return fail(prev, "درخواست پیدا نشد");
  const res = await step(customer.id, parsed.data.requestId, new Date(parsed.data.deadlineSeen));
  if (!res.ok) return fail(prev, res.error);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

export async function acceptRequestAction(prev: FormState, formData: FormData) {
  return answerStep(prev, formData, acceptRequest);
}
export async function declineRequestAction(prev: FormState, formData: FormData) {
  return answerStep(prev, formData, declineRequest);
}

/** The shopper writes to the shop on their own request. */
export async function shopperMessageAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const customer = await getCurrentCustomer();
  if (!customer) return fail(prev, "دوباره وارد شوید");
  const res = await sendShopperMessage(customer.id, parsed.data.requestId, parsed.data.message);
  if (!res.ok) return fail(prev, res.error);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

/** Polled by the shop header of a signed-in shopper: answers not seen yet. */
export async function myUnseenCountAction(): Promise<number> {
  const customer = await getCurrentCustomer();
  return customer ? myUnseenCount(customer.id) : 0;
}

// ── Staff ──────────────────────────────────────────────────────────────────────────────

/** Every staff action: signed-in staff only (checked in the DB), then the step as that person. */
async function staffStep(
  prev: FormState,
  run: (staff: CurrentStaff) => Promise<{ ok: true } | { ok: false; error: string }>,
): Promise<FormState> {
  const staff = await requireStaff();
  const res = await run(staff);
  if (!res.ok) return fail(prev, res.error);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

export async function editRowAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rowEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const { rowId, manualProfitToman, ...v } = parsed.data;
  return staffStep(prev, (by) =>
    // The typed profit changes only when its box was on the page (staff allowed to see profit);
    // a save by someone who cannot see it leaves it as it is.
    editRow(by.id, rowId, formData.has("manualProfitToman") && canSee(by, "profit") ? { ...v, manualProfitToman } : v),
  );
}

export async function addRowAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addRowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const { requestId, ...v } = parsed.data;
  return staffStep(prev, (by) => addRow(by.id, requestId, v));
}

export async function invoiceDiscountAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = invoiceDiscountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const { requestId, kind, value } = parsed.data;
  return staffStep(prev, (by) => setInvoiceDiscount(by.id, requestId, kind, value));
}

export async function sendMessageAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, () => sendMessage(parsed.data.requestId, parsed.data.message));
}

export async function confirmRequestAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const { requestId, hours, message } = parsed.data;
  return staffStep(prev, (by) => confirmRequest(by.id, requestId, hours, message));
}

export async function rejectRequestAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => rejectRequest(by.id, parsed.data.requestId, parsed.data.message));
}

export async function reopenRequestAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => reopenRequest(by.id, parsed.data.requestId));
}

/** Polled by the admin alert every few seconds. */
export async function staffAlertCountsAction(): Promise<{ steps: number; messages: number }> {
  await requireStaff();
  return staffAlertCounts();
}

// ── Payment and order (#19) ────────────────────────────────────────────────────────────

/** Shopper: the payment form after card-to-card (an optional receipt photo in `receipt`). */
export async function sendPaymentAction(prev: FormState, formData: FormData): Promise<FormState> {
  // After an error the form shows what was typed again (the photo must be chosen again).
  const values: Record<string, string> = {};
  for (const k of ["tracking", "cardLast4", "paidDay", "paidHour", "paidMinute", "amount", "receiptFile"]) {
    const v = formData.get(k);
    if (typeof v === "string") values[k] = v;
  }
  const again = (error: string) => ({ ...fail(prev, error), values });
  const parsed = paymentFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return again(first(parsed.error));
  const customer = await getCurrentCustomer();
  if (!customer) return again("دوباره وارد شوید");
  const { requestId, ...form } = parsed.data;
  const res = await sendPayment(customer.id, requestId, form);
  if (!res.ok) return again(res.error);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

/** Shopper: the receipt photo is saved as soon as it is picked; the form then sends its name. */
export async function uploadReceiptAction(formData: FormData): Promise<{ name?: string; error?: string }> {
  const parsed = requestIdSchema.safeParse({ requestId: formData.get("requestId") });
  const file = formData.get("receipt");
  if (!parsed.success || !(file instanceof File) || file.size === 0) return { error: "عکسی انتخاب نشد" };
  const customer = await getCurrentCustomer();
  if (!customer) return { error: "دوباره وارد شوید" };
  const res = await uploadReceipt(customer.id, parsed.data.requestId, file);
  return res.ok ? { name: res.name } : { error: res.error };
}

export async function setPayeeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = payeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const { requestId, ...input } = parsed.data;
  return staffStep(prev, (by) => setPayee(by.id, requestId, input));
}

export async function confirmPaymentAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentVerdictSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => confirmPayment(by.id, parsed.data.requestId, parsed.data.paymentId));
}

export async function paymentNotFoundAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = paymentVerdictSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => paymentNotFound(by.id, parsed.data.requestId, parsed.data.paymentId, parsed.data.reason));
}

export async function collectingAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => markCollecting(by.id, parsed.data.requestId));
}

export async function shippedAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = shipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => markShipped(by.id, parsed.data.requestId, parsed.data.code));
}

export async function refundAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = refundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, (by) => refundOrder(by.id, parsed.data.requestId, parsed.data.reason));
}

/** Shopper: the delivery method, saved as soon as it is picked (before «پرداخت با»). */
export async function setDeliveryAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = deliverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const customer = await getCurrentCustomer();
  if (!customer) return fail(prev, "دوباره وارد شوید");
  const res = await setDelivery(customer.id, parsed.data.requestId, parsed.data.deliveryMethod);
  if (!res.ok) return fail(prev, res.error);
  refresh();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

/** Staff: the parcel tracking code, saved while typed. */
export async function shippingCodeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = shippingCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  return staffStep(prev, () => saveShippingCode(parsed.data.requestId, parsed.data.code));
}

/** Staff: a refund receipt photo is saved as soon as it is picked; the form then sends its name. */
export async function uploadRefundReceiptAction(formData: FormData): Promise<{ name?: string; error?: string }> {
  await requireStaff();
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { error: "عکسی انتخاب نشد" };
  const res = await uploadRefundReceipt(file);
  return res.ok ? { name: res.name } : { error: res.error };
}

/** Staff: one money transfer back to the shopper. */
export async function addRefundAction(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addRefundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, first(parsed.error));
  const { requestId, ...input } = parsed.data;
  return staffStep(prev, (by) => addRefund(by.id, requestId, input));
}
