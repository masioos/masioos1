import Link from "next/link";
import { Suspense } from "react";
import { RequestsMenuBadge } from "@/modules/requests";

// Admin menu. No sign-in yet (#9): must be added before the site goes public.
const links = [
  { href: "/admin/warehouses", label: "انبارها" },
  { href: "/admin/catalog", label: "کالاها" },
  { href: "/admin/catalog/new", label: "کالای جدید" },
  { href: "/admin/catalog/import", label: "ورود از Excel" },
  { href: "/admin/catalog/lists", label: "فهرست‌ها" },
  { href: "/admin/customers", label: "مشتری‌ها" },
  { href: "/admin/settings", label: "تنظیمات" },
  { href: "/", label: "فروشگاه" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="bg-muted/40 flex flex-wrap gap-4 border-b px-8 py-3 text-sm">
        <span className="font-bold">مدیریت</span>
        <Link href="/admin/requests" className="text-primary hover:underline">
          درخواست‌ها
          <Suspense fallback={null}>
            <RequestsMenuBadge />
          </Suspense>
        </Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-primary hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
