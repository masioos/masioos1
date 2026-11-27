"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";
import {
  isValidCode,
  listItemSchema,
  parseStockSheetRows,
  productFlagsSchema,
  productFormSchema,
  type StockRowError,
} from "./rules";
import {
  addPhoto,
  approveIsacoWaiting,
  chooseIsacoWarehouse,
  createProduct,
  dropSheetFile,
  importStockSheet,
  keepSheetFile,
  previewStockSheet,
  readSheetFile,
  type ImportPreview,
  warehouseExists,
  removePhoto,
  saveListItem,
  setProductFlag,
  updateProduct,
  type ImportReport,
} from "./service";
import { requireManager } from "@/modules/staff";

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
  await requireManager();
  const parsed = listItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const res = await saveListItem(parsed.data);
  if (!res.ok) return { error: res.error };
  refreshAll();
  return { ok: true };
}

// ── Products ───────────────────────────────────────────────────────────────────────────

/** What staff typed, sent back on an error so the form shows it again (React clears a form after an action). */
export type ProductFormState = FormState & {
  values?: Record<string, string | string[]>;
  // Changes after every submit, so the form re-mounts with fresh defaults.
  attempt?: number;
};

function typedValues(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of formData) if (typeof v === "string" && k !== "carIds") out[k] = v;
  out.carIds = formData.getAll("carIds").filter((v): v is string => typeof v === "string");
  return out;
}

function productError(prev: ProductFormState, formData: FormData, error: string): ProductFormState {
  return { error, values: typedValues(formData), attempt: (prev.attempt ?? 0) + 1 };
}

function readProductForm(formData: FormData) {
  return productFormSchema.safeParse({
    ...Object.fromEntries(formData),
    carIds: formData.getAll("carIds"),
  });
}

export async function createProductAction(
  prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const staff = await requireManager();
  const parsed = readProductForm(formData);
  if (!parsed.success) return productError(prev, formData, firstError(parsed.error));
  const res = await createProduct(parsed.data, staff.id);
  if (!res.ok) return productError(prev, formData, res.error);
  refreshAll();
  // Open the edit page, where photos can be added.
  redirect(`/admin/catalog/${res.id}?saved=1`);
}

export async function updateProductAction(
  prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const staff = await requireManager();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "کالا پیدا نشد" };
  const parsed = readProductForm(formData);
  if (!parsed.success) return productError(prev, formData, firstError(parsed.error));
  const res = await updateProduct(id.data, parsed.data, staff.id);
  if (!res.ok) return productError(prev, formData, res.error);
  refreshAll();
  return { ok: true, attempt: (prev.attempt ?? 0) + 1 };
}

export async function setProductFlagAction(formData: FormData): Promise<void> {
  await requireManager();
  const parsed = productFlagsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setProductFlag(parsed.data.id, parsed.data.flag, parsed.data.value);
  refreshAll();
}

// ── Photos ─────────────────────────────────────────────────────────────────────────────

export async function addPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireManager();
  const productId = z.uuid().safeParse(formData.get("productId"));
  const file = formData.get("photo");
  if (!productId.success || !(file instanceof File)) return { error: "فایلی انتخاب نشده است" };
  const res = await addPhoto(productId.data, file);
  if (!res.ok) return { error: res.error };
  refreshAll();
  return { ok: true };
}

export async function removePhotoAction(formData: FormData): Promise<void> {
  await requireManager();
  const id = z.uuid().safeParse(formData.get("photoId"));
  if (!id.success) return;
  await removePhoto(id.data);
  refreshAll();
}

// ── Excel import ───────────────────────────────────────────────────────────────────────

/**
 * «ورود از Excel» in steps (#2): «preview» (file read and kept, nothing written) → the manager
 * ticks new goods → «done» (written, with the report).
 */
export type ImportState =
  | { step?: undefined; error?: string }
  | { step: "preview"; error?: string; token: string; warehouseId: string; preview: ImportPreview; fileErrors: StockRowError[] }
  | { step: "done"; report: ImportReport & { fileErrors: StockRowError[] } };

const MAX_SHEET_BYTES = 5 * 1024 * 1024;

async function readRows(bytes: Buffer): Promise<ReturnType<typeof parseStockSheetRows>> {
  try {
    return parseStockSheetRows(await readSheet(bytes));
  } catch {
    return { ok: false, error: "فایل خوانده نشد. آیا فایل Excel سالم است؟" };
  }
}

/** Step 1 → 2: reads the sheet, keeps it on the server, and shows what it would change. */
export async function previewStockSheetAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireManager();
  const warehouseId = z.uuid().safeParse(formData.get("warehouseId"));
  if (!warehouseId.success || !(await warehouseExists(warehouseId.data))) {
    return { error: "انبار را انتخاب کنید" };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "فایل Excel را انتخاب کنید" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "فقط فایل .xlsx قبول می‌شود" };
  if (file.size > MAX_SHEET_BYTES) return { error: "حجم فایل باید کمتر از ۵ مگابایت باشد" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const sheet = await readRows(bytes);
  if (!sheet.ok) return { error: sheet.error };
  const preview = await previewStockSheet(warehouseId.data, sheet.rows, sheet.errors);
  if (!preview) return { error: "انبار را انتخاب کنید" };
  const token = await keepSheetFile(bytes, { warehouseId: warehouseId.data, mode: preview.mode });
  return { step: "preview", token, warehouseId: warehouseId.data, preview, fileErrors: sheet.errors };
}

const applySchema = z.object({
  token: z.uuid(),
  confirmed: z.literal("on").optional(),
});

/**
 * Step 2 → 3: reads the kept sheet again on the server (rows never come from the browser) and
 * writes it. Only the ticked new codes are created.
 */
export async function applyStockSheetAction(prev: ImportState, formData: FormData): Promise<ImportState> {
  const staff = await requireManager();
  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "فایل را دوباره انتخاب کنید" };
  const selected = new Set(formData.getAll("newCode").map(String).filter(isValidCode));
  // The warehouse and mode come from what was saved with the file, never from the form.
  const kept = await readSheetFile(parsed.data.token);
  if (!kept) return { error: "فایل پیدا نشد. دوباره انتخابش کنید." };
  const sheet = await readRows(kept.bytes);
  if (!sheet.ok) return { error: sheet.error };

  const res = await importStockSheet(kept.kept.warehouseId, sheet.rows, {
    selectedNew: selected,
    confirmed: parsed.data.confirmed === "on",
    rejected: sheet.errors,
    previewMode: kept.kept.mode,
    staffId: staff.id,
  });
  if (!res.ok) return prev.step === "preview" ? { ...prev, error: res.error } : { error: res.error };
  await dropSheetFile(parsed.data.token);
  refreshAll();
  return { step: "done", report: { ...res.report, fileErrors: sheet.errors } };
}

// ── ISACO prices (#8) ──────────────────────────────────────────────────────────────────

/** «انبار ایساکو»: the one warehouse ISACO's price file updates. Saves as soon as it is picked. */
export async function chooseIsacoWarehouseAction(formData: FormData): Promise<{ error?: string }> {
  await requireManager();
  const id = z.uuid().safeParse(formData.get("warehouseId"));
  if (!id.success) return { error: "انبار را انتخاب کنید" };
  const res = await chooseIsacoWarehouse(id.data);
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/warehouses");
  return {};
}

/** «تأیید تغییرهای بزرگ» of the newest ISACO file. */
export async function approveIsacoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireManager();
  const runId = z.uuid().safeParse(formData.get("runId"));
  if (!runId.success) return { error: "صفحه را دوباره باز کنید" };
  const res = await approveIsacoWaiting(staff.id, runId.data);
  if (!res.ok) return { error: res.error };
  refreshAll();
  return { ok: true };
}
