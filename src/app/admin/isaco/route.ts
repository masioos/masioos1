import { revalidatePath } from "next/cache";
import { uploadIsacoFile } from "@/modules/catalog";

// ISACO's price file (#8): too big for a server action, so it is posted here. Manager only (checked inside).
export async function POST(request: Request) {
  const answer = await uploadIsacoFile(request);
  if ("report" in answer) revalidatePath("/", "layout");
  return Response.json(answer, { headers: { "Cache-Control": "no-store" } });
}
