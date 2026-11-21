"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";
import {
  listItemSchema,
  parseStockSheetRows,
  productFlagsSchema,
  productFormSchema,
  type StockRowError,
} from "./rules";
import {
  addPhoto,
  createProduct,
  importStockSheet,
  removePhoto,
  saveListItem,
  setProductFlag,
  updateProduct,
  type ImportReport,
} from "./service";

// Server actions for the catalog admin. Each validates on the server with zod (rules.ts).
// Admin has no sign-in yet (#9): fine on a local PC, must be solved before the site goes public.

export type FormState = { error?: string; ok?: boolean };

/** Catalog changes show on shop pages, admin pages and product pages. */
function refreshAll() {
  revalidatePath("/", "layout");
}

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "اطلاعات فرم درست نیست";
}

// ── Lists ──────────────────────────────────────────────────────────────────────────────

export async function saveListItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = listItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const res = await saveListItem(parsed.data);
  if (!res.ok) return { error: res.error };
  refreshAll();
  return { ok: true };
}

// ── Products ───────────────────────────────────────────────────────────────────────────

function readProductForm(formData: FormData) {
  return productFormSchema.safeParse({
    ...Object.fromEntries(formData),
    carIds: formData.getAll("carIds"),
  });
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readProductForm(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const res = await createProduct(parsed.data);
  if (!res.ok) return { error: res.error };
  refreshAll();
  // Open the edit page, where photos can be added.
  redirect(`/admin/catalog/${res.id}?saved=1`);
}

export async function updateProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "کالا پیدا نشد" };
  const parsed = readProductForm(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const res = await updateProduct(id.data, parsed.data);
  if (!res.ok) return { error: res.error };
  refreshAll();
  return { ok: true };
}

export async function setProductFlagAction(formData: FormData): Promise<void> {
  const parsed = productFlagsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setProductFlag(parsed.data.id, parsed.data.flag, parsed.data.value);
  refreshAll();
}

// ── Photos ─────────────────────────────────────────────────────────────────────────────

export async function addPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = z.uuid().safeParse(formData.get("productId"));
  const file = formData.get("photo");
  if (!productId.success || !(file instanceof File)) return { error: "فایلی انتخاب نشده است" };
  const res = await addPhoto(productId.data, file);
  if (!res.ok) return { error: res.error };
  refreshAll();
  return { ok: true };
}

export async function removePhotoAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("photoId"));
  if (!id.success) return;
  await removePhoto(id.data);
  refreshAll();
}

// ── Excel import ───────────────────────────────────────────────────────────────────────

export type ImportState = {
  error?: string;
  report?: ImportReport & { fileErrors: StockRowError[] };
};

const MAX_SHEET_BYTES = 5 * 1024 * 1024;

export async function importStockSheetAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const warehouseId = z.uuid().safeParse(formData.get("warehouseId"));
  if (!warehouseId.success) return { error: "انبار را انتخاب کنید" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "فایل Excel را انتخاب کنید" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "فقط فایل .xlsx قبول می‌شود" };
  if (file.size > MAX_SHEET_BYTES) return { error: "حجم فایل باید کمتر از ۵ مگابایت باشد" };

  let rows: unknown[][];
  try {
    rows = await readSheet(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "فایل خوانده نشد. آیا فایل Excel سالم است؟" };
  }
  const sheet = parseStockSheetRows(rows);
  if (!sheet.ok) return { error: sheet.error };

  const report = await importStockSheet(warehouseId.data, sheet.rows);
  refreshAll();
  return { report: { ...report, fileErrors: sheet.errors } };
}
