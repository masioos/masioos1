import { readRefundReceipt } from "@/modules/requests";

// Refund receipt photos (#19): the shopper of that request and signed-in staff only, never cached.
export async function GET(_req: Request, ctx: RouteContext<"/requests/refund-receipts/[file]">) {
  const { file } = await ctx.params;
  const photo = await readRefundReceipt(file);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
