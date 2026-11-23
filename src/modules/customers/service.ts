import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db/client";
import { hashPassword, verifyPassword } from "./password";
import { type RegisterInput } from "./rules";
import { customers, customersSessions } from "./schema";

// Server-side use cases of the customers module. Only this module touches its tables.

const SESSION_COOKIE = "anb_session";
const SESSION_DAYS = 30;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type CurrentCustomer = {
  id: string;
  fullName: string;
  mobile: string;
  email: string | null;
  lastAddress: string;
};

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

/** Starts a session: random token in an httpOnly cookie, only its hash in the DB. Server actions only. */
async function startSession(customerId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(customersSessions).values({ customerId, tokenHash: sha256(token), expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function register(input: RegisterInput): Promise<Result> {
  const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.mobile, input.mobile));
  if (existing) return { ok: false, error: "با این شماره قبلاً حساب ساخته شده است. وارد شوید." };
  const [row] = await db
    .insert(customers)
    .values({
      fullName: input.fullName,
      mobile: input.mobile,
      email: input.email,
      passwordHash: hashPassword(input.password),
    })
    .onConflictDoNothing()
    .returning({ id: customers.id });
  if (!row) return { ok: false, error: "با این شماره قبلاً حساب ساخته شده است. وارد شوید." };
  await startSession(row.id);
  return { ok: true };
}

const WRONG_LOGIN = "شماره همراه یا رمز اشتباه است";

export async function login(mobile: string, password: string): Promise<Result> {
  const [row] = await db
    .select({ id: customers.id, passwordHash: customers.passwordHash })
    .from(customers)
    .where(eq(customers.mobile, mobile));
  // Same message for an unknown mobile and a wrong password.
  if (!row || !verifyPassword(password, row.passwordHash)) return { ok: false, error: WRONG_LOGIN };
  await startSession(row.id);
  return { ok: true };
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(customersSessions).where(eq(customersSessions.tokenHash, sha256(token)));
  store.delete(SESSION_COOKIE);
}

/** The signed-in shopper, or null. Reads the cookie: call it inside <Suspense> or a server action. */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      mobile: customers.mobile,
      email: customers.email,
      lastAddress: customers.lastAddress,
    })
    .from(customersSessions)
    .innerJoin(customers, eq(customers.id, customersSessions.customerId))
    .where(and(eq(customersSessions.tokenHash, sha256(token)), gt(customersSessions.expiresAt, sql`now()`)));
  return row ?? null;
});

export async function saveLastAddress(customerId: string, address: string) {
  await db.update(customers).set({ lastAddress: address }).where(eq(customers.id, customerId));
}

/** Staff set a new password for a shopper who called support. Signs the shopper out everywhere. */
export async function setPassword(customerId: string, password: string): Promise<Result> {
  const updated = await db
    .update(customers)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(customers.id, customerId))
    .returning({ id: customers.id });
  if (updated.length === 0) return { ok: false, error: "مشتری پیدا نشد" };
  await db.delete(customersSessions).where(eq(customersSessions.customerId, customerId));
  return { ok: true };
}

export async function listCustomers() {
  return db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      mobile: customers.mobile,
      email: customers.email,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .orderBy(asc(customers.fullName));
}

/** Contact details of shoppers by id, for the staff request pages. */
export async function getCustomersByIds(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, CurrentCustomer>();
  const rows = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      mobile: customers.mobile,
      email: customers.email,
      lastAddress: customers.lastAddress,
    })
    .from(customers)
    .where(inArray(customers.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r]));
}
