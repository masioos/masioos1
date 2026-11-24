"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loginSchema, registerSchema, safeNextPath, setPasswordSchema } from "./rules";
import { login, logout, register, setPassword } from "./service";
import { requireStaff } from "@/modules/staff";

// Server actions for shopper sign-up / sign-in and for staff. All validated on the server.

export type AuthState = { error?: string; values?: Record<string, string>; attempt?: number };

/** Sends back what was typed (never the password) so the form keeps it after an error. */
function keep(prev: AuthState, formData: FormData, error: string): AuthState {
  const values: Record<string, string> = {};
  for (const k of ["fullName", "mobile", "email"]) {
    const v = formData.get(k);
    if (typeof v === "string") values[k] = v;
  }
  return { error, values, attempt: (prev.attempt ?? 0) + 1 };
}

export async function registerAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return keep(prev, formData, parsed.error.issues[0]?.message ?? "اطلاعات درست نیست");
  const res = await register(parsed.data);
  if (!res.ok) return keep(prev, formData, res.error);
  revalidatePath("/", "layout");
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function loginAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return keep(prev, formData, parsed.error.issues[0]?.message ?? "اطلاعات درست نیست");
  const res = await login(parsed.data.mobile, parsed.data.password);
  if (!res.ok) return keep(prev, formData, res.error);
  revalidatePath("/", "layout");
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function logoutAction(): Promise<void> {
  await logout();
  revalidatePath("/", "layout");
  redirect("/");
}

export type SetPasswordState = { error?: string; ok?: boolean };

export async function setPasswordAction(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  await requireStaff();
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const res = await setPassword(parsed.data.customerId, parsed.data.password);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
