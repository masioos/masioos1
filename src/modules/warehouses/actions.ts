"use server";

import { revalidatePath } from "next/cache";
import { newWarehouseSchema, setCardSchema, setProfitSchema } from "./rules";
import { createWarehouse, setWarehouseCard, setWarehouseProfit } from "./service";
import { requireManager } from "@/modules/staff";

export type CreateWarehouseState = { error?: string; ok?: boolean };
export type SetProfitState = { error?: string; ok?: boolean };

// Server action for the admin form. It validates on the server; the form never trusts the browser.
export async function createWarehouseAction(
  _prev: CreateWarehouseState,
  formData: FormData,
): Promise<CreateWarehouseState> {
  await requireManager();
  const parsed = newWarehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await createWarehouse(parsed.data);
  revalidatePath("/admin/warehouses");
  return { ok: true };
}

export type SetCardState = { error?: string; ok?: boolean };

export async function setWarehouseCardAction(_prev: SetCardState, formData: FormData): Promise<SetCardState> {
  await requireManager();
  const parsed = setCardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await setWarehouseCard(parsed.data.id, parsed.data.cardNumber, parsed.data.cardHolder);
  revalidatePath("/admin/warehouses");
  return { ok: true };
}

// A warehouse's profit changes the shop price of all its products, so the shop pages refresh too.
export async function setWarehouseProfitAction(
  _prev: SetProfitState,
  formData: FormData,
): Promise<SetProfitState> {
  await requireManager();
  const parsed = setProfitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await setWarehouseProfit(parsed.data.id, parsed.data.profitBp);
  revalidatePath("/", "layout");
  return { ok: true };
}
