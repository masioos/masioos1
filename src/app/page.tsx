import Link from "next/link";

// Placeholder home page. The shop pages come from the first grilled features.
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">انبارنت</h1>
      <p>فروشگاه هنوز در حال ساخت است.</p>
      <Link className="text-primary underline" href="/admin/warehouses">
        مدیریت انبارها
      </Link>
    </main>
  );
}
