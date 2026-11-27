import "server-only";
import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import { parsePriceListLines, pdfListToStockRows, type PdfLine, type StockRow, type StockRowError } from "./rules";

// PDF price lists (#3): read the text of a readable PDF (unpdf = Mozilla's pdf.js), line by line.
// A scanned PDF (pages that are pictures) has no text and is refused, not guessed (#25).

export const SCANNED_PDF = "این PDF عکس است و خوانده نمی‌شود؛ فایل اکسل یا PDF قابل کپی بدهید.";

/** The text pieces of every page, grouped into lines by their height on the page (top first). */
async function readPdfLines(bytes: Uint8Array): Promise<PdfLine[]> {
  const pdf = await getDocumentProxy(bytes);
  const out: PdfLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const byY = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      byY.set(y, [...(byY.get(y) ?? []), { x: Math.round(item.transform[4]), s: item.str }]);
    }
    const ys = [...byY.keys()].sort((a, b) => b - a);
    ys.forEach((y, i) => out.push({ items: byY.get(y) ?? [], pageStart: i === 0 }));
  }
  return out;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** A warehouse's PDF list → the same rows the Excel stock sheet gives, or a Persian error. */
export async function readPdfStockRows(
  warehouseId: string,
  bytes: Uint8Array,
): Promise<{ ok: true; rows: StockRow[]; errors: StockRowError[] } | { ok: false; error: string }> {
  let lines: PdfLine[];
  try {
    lines = await readPdfLines(bytes);
  } catch {
    return { ok: false, error: "فایل PDF خوانده نشد. آیا فایل سالم است؟" };
  }
  if (!lines.some((l) => l.items.some((i) => /\d/.test(i.s)))) return { ok: false, error: SCANNED_PDF };
  const list = parsePriceListLines(lines);
  if (!list.ok) return list;
  return { ok: true, ...pdfListToStockRows(warehouseId, list.rows, sha256) };
}
