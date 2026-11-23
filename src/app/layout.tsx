import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "@fontsource-variable/vazirmatn";
import { SiteHeaderLinks } from "@/modules/requests";
import "./globals.css";

export const metadata: Metadata = {
  title: "انبارنت",
  description: "فروشگاه آنلاین چند انباری",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-8">
          <Link href="/" className="text-lg font-bold">
            انبارنت
          </Link>
          <Suspense fallback={null}>
            <SiteHeaderLinks />
          </Suspense>
        </header>
        {children}
      </body>
    </html>
  );
}
