"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/mobile";
import { addSellerSchema, staffIdSchema, staffLoginSchema, switchSchema } from "./rules";
import { addSeller, LOGIN_PATH, requireManager, resetSellerPassword, setSellerSwitch, signIn, signOut } from "./service";

// Server actions of the staff module. All validated on the server; manager actions check the role.

export type LoginState = { error?: string; mobile?: string; attempt?: number };

export async function staffSignInAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const mobile = String(formData.get("mobile") ?? "");
  const parsed = staffLoginSchema.safeParse(Object.fromEntries(formData));
  const fail = (error: string) => ({ error, mobile, attempt: (prev.attempt ?? 0) + 1 });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "اطلاعات درست نیست");
  const res = await signIn(parsed.data.mobile, parsed.data.password);
  if (!res.ok) return fail(res.error);
  const next = safeNextPath(String(formData.get("next") ?? ""), "/admin/requests");
  redirect(next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin/requests");
}

export async function staffSignOutAction(): Promise<void> {
  await signOut();
  redirect(LOGIN_PATH);
}

/** The manager's answer: a password shown once, or an error. */
export type PasswordState = { error?: string; password?: string; attempt?: number };

export async function addSellerAction(prev: PasswordState, formData: FormData): Promise<PasswordState> {
  await requireManager();
  const attempt = (prev.attempt ?? 0) + 1;
  const parsed = addSellerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "اطلاعات درست نیست", attempt };
  const res = await addSeller(parsed.data.fullName, parsed.data.mobile);
  if (!res.ok) return { error: res.error, attempt };
  revalidatePath("/admin/staff");
  return { password: res.password, attempt };
}

export async function resetPasswordAction(prev: PasswordState, formData: FormData): Promise<PasswordState> {
  await requireManager();
  const attempt = (prev.attempt ?? 0) + 1;
  const parsed = staffIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "فروشنده پیدا نشد", attempt };
  const res = await resetSellerPassword(parsed.data.staffId);
  if (!res.ok) return { error: res.error, attempt };
  return { password: res.password, attempt };
}

export async function setSwitchAction(formData: FormData): Promise<{ error?: string }> {
  await requireManager();
  const parsed = switchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "درخواست درست نیست" };
  const res = await setSellerSwitch(parsed.data.staffId, parsed.data.which, parsed.data.on);
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/staff");
  return {};
}
