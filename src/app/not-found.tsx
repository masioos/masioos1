import Link from "next/link";

// Shown for unknown pages and for products that are inactive or do not exist.
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">این صفحه پیدا نشد</h1>
      <p className="text-muted-foreground">ممکن است آدرس اشتباه باشد یا این صفحه دیگر در دسترس نباشد.</p>
      <Link href="/" className="text-primary underline">
        بازگشت به فروشگاه
      </Link>
    </main>
  );
}
