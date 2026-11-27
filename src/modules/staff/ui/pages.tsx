import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { faDateTime } from "@/lib/date";
import { safeNextPath } from "@/lib/mobile";
import { staffSignOutAction } from "../actions";
import { getCurrentStaff, listStaff, requireManager, requireStaff } from "../service";
import { AddSellerForm, ResetPasswordButton, SellerRowActions, StaffLoginForm, SwitchBox } from "./staff-forms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `/admin/login`. Someone already signed in goes straight on. */
export async function StaffLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const v = (await searchParams).next;
  const next = safeNextPath(Array.isArray(v) ? v[0] : v, "/admin/requests");
  if (await getCurrentStaff()) redirect(next.startsWith("/admin") ? next : "/admin/requests");
  return <StaffLoginForm next={next} />;
}

const MANAGER_LINKS = [
  { href: "/admin/catalog", label: "کالاها" },
  { href: "/admin/catalog/new", label: "کالای جدید" },
  { href: "/admin/catalog/lists", label: "فهرست‌ها" },
  { href: "/admin/warehouses", label: "انبارها" },
  { href: "/admin/customers", label: "مشتری‌ها" },
  { href: "/admin/staff", label: "فروشنده‌ها" },
  { href: "/admin/settings", label: "تنظیمات" },
];

const SELLER_LINKS = [
  { href: "/admin/catalog", label: "کالاها" },
  { href: "/admin/customers", label: "مشتری‌ها" },
];

/**
 * The admin menu for whoever is signed in (nothing on the sign-in page).
 * `requestsBadge` is the «درخواست‌ها (n)» count from the requests module.
 */
export async function StaffMenu({ requestsBadge }: { requestsBadge: ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) return <span className="font-bold">مدیریت</span>;
  const links = staff.role === "manager" ? MANAGER_LINKS : SELLER_LINKS;
  return (
    <>
      <span className="font-bold">مدیریت</span>
      <Link href="/admin/requests" className="text-primary hover:underline">
        درخواست‌ها
        {requestsBadge}
      </Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="text-primary hover:underline">
          {l.label}
        </Link>
      ))}
      <Link href="/" className="text-primary hover:underline">
        فروشگاه
      </Link>
      <span className="ms-auto flex items-center gap-2">
        <span className="text-muted-foreground">
          {staff.fullName} ({staff.role === "manager" ? "مدیر" : "فروشنده"})
        </span>
        <form action={staffSignOutAction}>
          <Button type="submit" size="xs" variant="ghost">
            خروج
          </Button>
        </form>
      </span>
    </>
  );
}

const when = (d: Date | null) => (d ? faDateTime(d) : "—");

/** `/admin/staff`: the manager's list of staff, with the switches and «رمز جدید». */
export async function StaffTable() {
  await requireManager();
  const rows = await listStaff();
  return (
    <div className="flex flex-col gap-6">
      <AddSellerForm />
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>ویرایش / حذف</TableHead>
              <TableHead>شماره همراه</TableHead>
              <TableHead className="text-center">فعال</TableHead>
              <TableHead className="text-center">قیمت خرید</TableHead>
              <TableHead className="text-center">پرافیت</TableHead>
              <TableHead>آخرین ورود</TableHead>
              <TableHead>آخرین خروج</TableHead>
              <TableHead>آخرین کار</TableHead>
              <TableHead>رمز</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => {
              const seller = s.role === "seller";
              return (
                <TableRow key={s.id} className={s.isActive ? "" : "text-muted-foreground"}>
                  <TableCell className="font-medium">
                    {s.fullName}
                    <span className="text-muted-foreground block text-xs">
                      {seller ? "فروشنده" : "مدیر"}
                      {s.online && <span className="ms-2 text-green-700">● آنلاین</span>}
                    </span>
                  </TableCell>
                  <TableCell>{seller ? <SellerRowActions staffId={s.id} fullName={s.fullName} mobile={s.mobile} /> : "—"}</TableCell>
                  <TableCell dir="ltr" className="text-end">
                    {s.mobile}
                  </TableCell>
                  {seller ? (
                    <>
                      <TableCell className="text-center">
                        <SwitchBox staffId={s.id} which="active" on={s.isActive} label={`فعال بودن ${s.fullName}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <SwitchBox
                          staffId={s.id}
                          which="purchasePrice"
                          on={s.canSeePurchasePrice}
                          label={`دیدن قیمت خرید برای ${s.fullName}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <SwitchBox staffId={s.id} which="profit" on={s.canSeeProfit} label={`دیدن پرافیت برای ${s.fullName}`} />
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={3} className="text-muted-foreground text-center text-xs">
                      همیشه فعال، همه چیز را می‌بیند
                    </TableCell>
                  )}
                  <TableCell>{when(s.lastSignInAt)}</TableCell>
                  <TableCell>{when(s.lastSignOutAt)}</TableCell>
                  <TableCell className="max-w-56 whitespace-normal">
                    {s.lastAction || "—"}
                    {s.lastActionAt && <span className="text-muted-foreground block text-xs">{faDateTime(s.lastActionAt)}</span>}
                  </TableCell>
                  <TableCell>{seller ? <ResetPasswordButton staffId={s.id} /> : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Wraps a manager-only page: a seller is sent to the requests list, nobody signed in to sign-in. */
export async function ManagerOnly({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

/** Wraps a page any signed-in staff member may open. */
export async function StaffOnly({ children }: { children: ReactNode }) {
  await requireStaff();
  return children;
}
