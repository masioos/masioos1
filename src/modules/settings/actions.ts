"use server";

import { revalidatePath } from "next/cache";
import { supportPhoneSchema } from "./rules";
import { setSupportPhone } from "./service";

export type SettingsState = { error?: string; ok?: boolean };

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = supportPhoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await setSupportPhone(parsed.data.supportPhone);
  revalidatePath("/", "layout");
  return { ok: true };
}
