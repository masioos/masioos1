"use server";

import { revalidatePath } from "next/cache";
import { moveSchema, newWarehouseSchema, setCardSchema, setInfoSchema, setProfitSchema } from "./rules";
import { createWarehouse, moveWarehouse, setWarehouseCard, setWarehouseInfo, setWarehouseProfit } from "./service";
import { requireManager } from "@/modules/staff";

export type CreateWarehouseState = { error?: string; ok?: boolean; made?: number };

// Server action for the admin form. It validates on the server; the form never trusts the browser.
export async function createWarehouseAction(
  prev: CreateWarehouseState,
  formData: FormData,
): Promise<CreateWarehouseState> {
  await requireManager();
  const parsed = newWarehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await createWarehouse(parsed.data);
  revalidatePath("/admin/warehouses");
  return { ok: true, made: (prev.made ?? 0) + 1 };
}


/**
 * The warehouses list saves by itself (no «ذخیره» button): one part of a row at a time —
 * name and owner, the card and the name on it, or the profit percent.
 */
export async function saveWarehouseAction(formData: FormData): Promise<{ error?: string }> {
  await requireManager();
  const part = formData.get("part");
  const data = Object.fromEntries(formData);
  if (part === "info") {
    const parsed = setInfoSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    await setWarehouseInfo(parsed.data.id, parsed.data.name, parsed.data.ownerName);
  } else if (part === "card") {
    const parsed = setCardSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    await setWarehouseCard(parsed.data.id, parsed.data.cardNumber, parsed.data.cardHolder);
  } else if (part === "profit") {
    const parsed = setProfitSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };
    await setWarehouseProfit(parsed.data.id, parsed.data.profitBp);
    // The profit changes the shop price of all this warehouse's goods.
    revalidatePath("/", "layout");
    return {};
  } else {
    return { error: "درخواست درست نیست" };
  }
  revalidatePath("/admin/warehouses");
  return {};
}

/** ▲ ▼ at the end of a row in the warehouses list. */
export async function moveWarehouseAction(formData: FormData): Promise<void> {
  await requireManager();
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await moveWarehouse(parsed.data.id, parsed.data.direction);
  revalidatePath("/admin/warehouses");
}
