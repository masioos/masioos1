import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logoutAction } from "../actions";
import { safeNextPath } from "../rules";
import { getCurrentCustomer, listCustomers } from "../service";
import { LoginForm, RegisterForm } from "./auth-forms";
import { SetPasswordForm } from "./set-password-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function nextOf(searchParams: SearchParams) {
  const v = (await searchParams).next;
  return safeNextPath(Array.isArray(v) ? v[0] : v);
}

/** Login page body. A signed-in shopper goes straight on. */
export async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const next = await nextOf(searchParams);
  if (await getCurrentCustomer()) redirect(next);
  return <LoginForm next={next} />;
}

export async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const next = await nextOf(searchParams);
  if (await getCurrentCustomer()) redirect(next);
  return <RegisterForm next={next} />;
}

/** The forgot-password text from the brief. `phone` is the support number (settings module). */
export function ForgotPassword({ phone }: { phone: ReactNode }) {
  return (
    <div className="flex max-w-md flex-col gap-3 leading-8">
      <p>مشتری ارجمند شما می‌توانید از دو راه رمزتان را بازیابی کنید:</p>
      <ol className="list-inside list-decimal">
        <li>ارسال پیام به شماره پشتیبانی</li>
        <li>تماس با پشتیبانی</li>
      </ol>
      <p>شماره پشتیبانی: {phone}</p>
      <p className="text-muted-foreground text-sm">پشتیبانی برای شما رمز تازه می‌گذارد.</p>
    </div>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" size="xs" variant="ghost">
        خروج
      </Button>
    </form>
  );
}

/** Staff: shoppers and a new-password form for each. */
export async function CustomersTable() {
  const rows = await listCustomers();
  if (rows.length === 0) return <p>هنوز مشتری‌ای ثبت‌نام نکرده است.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>نام</TableHead>
          <TableHead>شماره همراه</TableHead>
          <TableHead>ایمیل</TableHead>
          <TableHead>رمز تازه</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell>{c.fullName}</TableCell>
            <TableCell dir="ltr" className="text-end">
              {c.mobile}
            </TableCell>
            <TableCell dir="ltr" className="text-end">
              {c.email ?? "—"}
            </TableCell>
            <TableCell>
              <SetPasswordForm customerId={c.id} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
