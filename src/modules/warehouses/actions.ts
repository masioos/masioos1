"use server";

import { revalidatePath } from "next/cache";
import { newWarehouseSchema } from "./rules";
import { createWarehouse } from "./service";

export type CreateWarehouseState = { error?: string; ok?: boolean };

// Server action for the admin form. It validates on the server; the form never trusts the browser.
export async function createWarehouseAction(
  _prev: CreateWarehouseState,
  formData: FormData,
): Promise<CreateWarehouseState> {
  const parsed = newWarehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await createWarehouse(parsed.data);
  revalidatePath("/admin/warehouses");
  return { ok: true };
}
