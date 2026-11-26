// Uploaded images (product photos, payment receipts). Pure; no file system here.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Only names this app wrote: "<uuid>.<jpg|png|webp>". Blocks path tricks like "../.env". */
export function isSafePhotoName(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(name);
}

/** The real image type from the file's first bytes (never trust the browser's label). */
export function detectImageType(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}

export const PHOTO_CONTENT_TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
