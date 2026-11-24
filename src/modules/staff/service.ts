import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { env } from "@/env";
import { IDLE_HOURS, isLocked, LOCK_MINUTES, LOCKED_MESSAGE, newPassword, type StaffRole } from "./rules";
import { staffSessions, staffSignInFailures, staffUsers } from "./schema";

/** Where staff sign in: hidden on the live site (ADMIN_LOGIN_PATH), "/admin/login" on a developer PC. */
export const LOGIN_PATH = env.ADMIN_LOGIN_PATH;

// Server-side use cases of the staff module. Only this module touches its tables.

/** Cookie of a staff session; separate from the shopper cookie. `src/proxy.ts` reads its name. */
export const STAFF_COOKIE = "anb_staff";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type CurrentStaff = {
  id: string;
  fullName: string;
  mobile: string;
  role: StaffRole;
  canSeePurchasePrice: boolean;
  canSeeProfit: boolean;
};

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const idleLimit = sql`now() - make_interval(hours => ${IDLE_HOURS})`;
const lockSince = sql`now() - make_interval(mins => ${LOCK_MINUTES})`;

const WRONG_LOGIN = "شماره همراه یا رمز اشتباه است";

/** Mobile + password → a session cookie. Unknown mobile, wrong password and inactive give one message. */
/** Checked when the mobile is unknown, so the answer takes as long as for a real one. */
const DUMMY_HASH = hashPassword("not-a-real-password");

export async function signIn(mobile: string, password: string): Promise<Result> {
  // The attempt is written first and counted after, so many tries sent at once cannot all pass
  // the check. 5 wrong passwords for this mobile in 15 minutes: closed, even for the right password.
  await db.insert(staffSignInFailures).values({ mobile });
  const [{ n }] = await db
    .select({ n: count() })
    .from(staffSignInFailures)
    .where(and(eq(staffSignInFailures.mobile, mobile), gt(staffSignInFailures.at, lockSince)));
  if (isLocked(n - 1)) return { ok: false, error: LOCKED_MESSAGE };
  const [u] = await db.select().from(staffUsers).where(eq(staffUsers.mobile, mobile));
  const passwordOk = verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !u.isActive || !passwordOk) {
    // Old rows mean nothing any more.
    await db.delete(staffSignInFailures).where(lt(staffSignInFailures.at, sql`now() - interval '1 day'`));
    return { ok: false, error: isLocked(n) ? LOCKED_MESSAGE : WRONG_LOGIN };
  }
  // Right password: this attempt and the earlier wrong ones are forgotten.
  await db.delete(staffSignInFailures).where(eq(staffSignInFailures.mobile, mobile));
  const token = randomBytes(32).toString("base64url");
  await db.insert(staffSessions).values({ staffId: u.id, tokenHash: sha256(token) });
  await db.update(staffUsers).set({ lastSignInAt: new Date() }).where(eq(staffUsers.id, u.id));
  // No expiry date: the browser drops it when closed; the DB ends it after IDLE_HOURS idle.
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return { ok: true };
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE)?.value;
  if (token) {
    const [s] = await db.delete(staffSessions).where(eq(staffSessions.tokenHash, sha256(token))).returning();
    if (s) await db.update(staffUsers).set({ lastSignOutAt: new Date() }).where(eq(staffUsers.id, s.staffId));
  }
  store.delete(STAFF_COOKIE);
}

/**
 * The signed-in staff member, or null. Checks the DB every time: the session exists, was used in
 * the last IDLE_HOURS (DB clock) and the person is still active. Reads the cookie: call it inside
 * <Suspense> or a server action.
 */
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => (await staffSession()).staff);

/**
 * `ended`: the cookie named a real session that has just ended (idle or made inactive). Only then
 * may a hidden sign-in address be shown; any other cookie is a stranger.
 */
const staffSession = cache(async (): Promise<{ staff: CurrentStaff | null; ended: boolean }> => {
  const staff = await readSession();
  return staff === "ended" ? { staff: null, ended: true } : { staff, ended: false };
});

async function readSession(): Promise<CurrentStaff | null | "ended"> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const hash = sha256(token);
  const [row] = await db
    .select({
      sessionId: staffSessions.id,
      fresh: sql<boolean>`${staffSessions.lastSeenAt} > ${idleLimit}`,
      lastSeenAt: staffSessions.lastSeenAt,
      id: staffUsers.id,
      fullName: staffUsers.fullName,
      mobile: staffUsers.mobile,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      canSeePurchasePrice: staffUsers.canSeePurchasePrice,
      canSeeProfit: staffUsers.canSeeProfit,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.staffId))
    .where(eq(staffSessions.tokenHash, hash));
  if (!row) return null;
  if (!row.fresh || !row.isActive) {
    // Idle too long (or made inactive): the session ends; its last use counts as the sign-out.
    await db.delete(staffSessions).where(eq(staffSessions.id, row.sessionId));
    if (!row.fresh) await db.update(staffUsers).set({ lastSignOutAt: row.lastSeenAt }).where(eq(staffUsers.id, row.id));
    return "ended";
  }
  // Keep the session alive while the person works (at most one write a minute).
  await db
    .update(staffSessions)
    .set({ lastSeenAt: sql`now()` })
    .where(and(eq(staffSessions.id, row.sessionId), lt(staffSessions.lastSeenAt, sql`now() - interval '1 minute'`)));
  return {
    id: row.id,
    fullName: row.fullName,
    mobile: row.mobile,
    role: row.role,
    canSeePurchasePrice: row.canSeePurchasePrice,
    canSeeProfit: row.canSeeProfit,
  };
}

/**
 * For every admin page and staff action: the signed-in staff member, or off to the sign-in page.
 * With a hidden sign-in address, only someone whose real session just ended is sent there; anyone
 * else sees «not found», so a made-up cookie never reveals the address.
 */
export async function requireStaff(): Promise<CurrentStaff> {
  const { staff, ended } = await staffSession();
  if (staff) return staff;
  if (LOGIN_PATH === "/admin/login" || ended) redirect(LOGIN_PATH);
  notFound();
}

/** Manager-only pages and actions. A seller is sent to the requests list. */
export async function requireManager(): Promise<CurrentStaff> {
  const staff = await requireStaff();
  if (staff.role !== "manager") redirect("/admin/requests");
  return staff;
}

// ── Manager: the «فروشنده‌ها» page ──────────────────────────────────────────────────────

export async function listStaff() {
  return db
    .select({
      id: staffUsers.id,
      fullName: staffUsers.fullName,
      mobile: staffUsers.mobile,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
      canSeePurchasePrice: staffUsers.canSeePurchasePrice,
      canSeeProfit: staffUsers.canSeeProfit,
      lastSignInAt: staffUsers.lastSignInAt,
      lastSignOutAt: staffUsers.lastSignOutAt,
      lastAction: staffUsers.lastAction,
      lastActionAt: staffUsers.lastActionAt,
      // Signed in now: a session used within the idle limit.
      // Written out with table names: inside a select list Drizzle leaves columns unqualified.
      online: sql<boolean>`exists (select 1 from staff_sessions ss where ss.staff_id = staff_users.id and ss.last_seen_at > ${idleLimit})`,
    })
    .from(staffUsers)
    .orderBy(asc(staffUsers.role), asc(staffUsers.fullName));
}

/** A new seller with a new password, shown once to the manager. */
export async function addSeller(fullName: string, mobile: string): Promise<Result<{ password: string }>> {
  const password = newPassword();
  const [row] = await db
    .insert(staffUsers)
    .values({ fullName, mobile, role: "seller", passwordHash: hashPassword(password) })
    .onConflictDoNothing()
    .returning({ id: staffUsers.id });
  if (!row) return { ok: false, error: "این شماره قبلاً ثبت شده است" };
  return { ok: true, password };
}

/** A new password for a seller; signs them out everywhere. The manager's own goes through the script. */
export async function resetSellerPassword(staffId: string): Promise<Result<{ password: string }>> {
  const password = newPassword();
  const updated = await db
    .update(staffUsers)
    .set({ passwordHash: hashPassword(password) })
    .where(and(eq(staffUsers.id, staffId), eq(staffUsers.role, "seller")))
    .returning({ id: staffUsers.id });
  if (updated.length === 0) return { ok: false, error: "فروشنده پیدا نشد" };
  await db.delete(staffSessions).where(eq(staffSessions.staffId, staffId));
  return { ok: true, password };
}

/** Active / purchase price / profit switch of a seller. Making someone inactive signs them out at once. */
export async function setSellerSwitch(staffId: string, which: "active" | "purchasePrice" | "profit", on: boolean): Promise<Result> {
  const set =
    which === "active" ? { isActive: on } : which === "purchasePrice" ? { canSeePurchasePrice: on } : { canSeeProfit: on };
  const updated = await db
    .update(staffUsers)
    .set(set)
    .where(and(eq(staffUsers.id, staffId), eq(staffUsers.role, "seller")))
    .returning({ id: staffUsers.id });
  if (updated.length === 0) return { ok: false, error: "فروشنده پیدا نشد" };
  if (which === "active" && !on) await db.delete(staffSessions).where(eq(staffSessions.staffId, staffId));
  return { ok: true };
}

// ── For other modules ─────────────────────────────────────────────────────────────────

/** «آخرین کار» on the sellers page, e.g. «فاکتور ۶ را تأیید کرد». */
export async function noteStaffAction(staffId: string, text: string) {
  await db.update(staffUsers).set({ lastAction: text, lastActionAt: new Date() }).where(eq(staffUsers.id, staffId));
}

/** Names of staff by id, for request history. */
export async function getStaffNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: staffUsers.id, fullName: staffUsers.fullName })
    .from(staffUsers)
    .where(inArray(staffUsers.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.fullName]));
}
