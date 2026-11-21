import { readPhoto } from "@/modules/catalog";

// Serves uploaded product photos from UPLOAD_DIR. The name is checked inside readPhoto.
export async function GET(_req: Request, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  const photo = await readPhoto(file);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: {
      "Content-Type": photo.contentType,
      // A file name is never reused (new uuid per upload), so it can be cached for a long time.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
