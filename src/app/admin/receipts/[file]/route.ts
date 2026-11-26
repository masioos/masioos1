import { readReceipt } from "@/modules/requests";

// Payment receipt photos (#19): signed-in staff only, never cached by anyone else.
export async function GET(_req: Request, ctx: RouteContext<"/admin/receipts/[file]">) {
  const { file } = await ctx.params;
  const photo = await readReceipt(file);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
