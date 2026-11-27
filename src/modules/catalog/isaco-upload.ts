import "server-only";
import { readSheet } from "read-excel-file/node";
import { requireManager } from "@/modules/staff";
import { parseIsacoSheet } from "./rules";
import { importIsacoPrices, type IsacoReport } from "./service";

// ISACO's full price file is about 17 MB, above the server-action body limit (11 MB), so it is
// posted to a route handler (`src/app/admin/isaco/route.ts`) that calls this. Manager only.

/** Room for a bigger file than today's 17 MB, but not unlimited. */
export const MAX_ISACO_BYTES = 30 * 1024 * 1024;

export type IsacoUploadAnswer = { report: IsacoReport } | { error: string };

export async function uploadIsacoFile(request: Request): Promise<IsacoUploadAnswer> {
  const staff = await requireManager();
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_ISACO_BYTES + 1024 * 1024) return { error: "حجم فایل باید کمتر از ۳۰ مگابایت باشد" };
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: "فایل نرسید. دوباره امتحان کنید." };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "فایل Excel را انتخاب کنید" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "فقط فایل .xlsx قبول می‌شود" };
  if (file.size > MAX_ISACO_BYTES) return { error: "حجم فایل باید کمتر از ۳۰ مگابایت باشد" };

  let rows: unknown[][];
  try {
    rows = await readSheet(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "فایل خوانده نشد. آیا فایل Excel سالم است؟" };
  }
  const sheet = parseIsacoSheet(rows);
  if (!sheet.ok) return { error: sheet.error };
  const res = await importIsacoPrices(staff.id, sheet);
  return res.ok ? { report: res.report } : { error: res.error };
}
