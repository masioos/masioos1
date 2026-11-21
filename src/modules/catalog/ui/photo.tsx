import Image from "next/image";

// A product photo served by /media/<fileName>. Unoptimized: files are already small, local and ours.
export function Photo({
  fileName,
  alt,
  size,
  className,
}: {
  fileName: string;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    <Image
      src={`/media/${fileName}`}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={className ?? "aspect-square rounded-lg border object-contain"}
    />
  );
}
