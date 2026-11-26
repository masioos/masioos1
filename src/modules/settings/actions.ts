"use server";

import { revalidatePath } from "next/cache";
import { gatewayTaxSchema, supportPhoneSchema } from "./rules";
import { setGatewayTaxPercent, setSupportPhone } from "./service";
import { requireManager } from "@/modules/staff";

export type SettingsState = { error?: string; ok?: boolean };

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireManager();
  const parsed = supportPhoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await setSupportPhone(parsed.data.supportPhone);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveGatewayTaxAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireManager();
  const parsed = gatewayTaxSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await setGatewayTaxPercent(parsed.data.gatewayTaxPercent);
  revalidatePath("/", "layout");
  return { ok: true };
}
