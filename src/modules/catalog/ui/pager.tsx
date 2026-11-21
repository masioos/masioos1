import Link from "next/link";

/** «قبلی / صفحه‌ی X از Y / بعدی» links that keep the other search params. */
export function Pager({
  basePath,
  params,
  page,
  pages,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="flex items-center justify-center gap-4 text-sm" aria-label="صفحه‌ها">
      {page > 1 ? (
        <Link className="text-primary underline" href={href(page - 1)}>
          قبلی
        </Link>
      ) : (
        <span className="text-muted-foreground">قبلی</span>
      )}
      <span>
        صفحه‌ی {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}
      </span>
      {page < pages ? (
        <Link className="text-primary underline" href={href(page + 1)}>
          بعدی
        </Link>
      ) : (
        <span className="text-muted-foreground">بعدی</span>
      )}
    </nav>
  );
}
