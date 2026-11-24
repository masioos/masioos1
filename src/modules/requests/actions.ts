"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addressSchema, getCurrentCustomer } from "@/modules/customers";
import { canSee, requireStaff, type CurrentStaff } from "@/modules/staff";
import {
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
} from "./service";

// Server actions of the requests module. Every input is validated here with zod.
// Staff actions have no sign-in yet (#9): fine on the local PC, required before going public.

export type FormState = { error?: string; ok?: boolean; attempt?: number };

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
