"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addPhotoAction, removePhotoAction } from "../actions";
import { Photo } from "./photo";

export function PhotoManager({
  productId,
  photos,
}: {
  productId: string;
  photos: { id: string; fileName: string }[];
}) {
  const [state, formAction, pending] = useActionState(addPhotoAction, {});
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-lg font-bold">عکس‌ها ({photos.length.toLocaleString("fa-IR")} از ۶)</h2>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-col items-center gap-1">
              <Photo fileName={p.fileName} alt={`عکس ${i + 1}`} size={120} />
              <form action={removePhotoAction}>
                <input type="hidden" name="photoId" value={p.id} />
                <Button type="submit" size="xs" variant="destructive">
                  حذف عکس
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {photos.length < 6 && (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="productId" value={productId} />
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-sm"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "در حال بارگذاری…" : "افزودن عکس"}
          </Button>
        </form>
      )}
      <p className="text-muted-foreground text-xs">JPG، PNG یا WEBP، هر عکس حداکثر ۵ مگابایت.</p>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
    </section>
  );
}
