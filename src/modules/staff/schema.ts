import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Tables owned by the staff module: people who sign in to /admin, and their sessions.
// Staff rows are never removed (request history points at them). «حذف» sets deleted_at: the person
// leaves the sellers list and cannot sign in; history keeps their name; the mobile can be used again.

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    // Normalized Iranian mobile "09xxxxxxxxx". The sign-in name.
    mobile: text("mobile").notNull(),
    // "scrypt:<salt hex>:<hash hex>" — see src/lib/password.ts. Never shown to anyone.
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["manager", "seller"] }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // Seller permissions the manager switches per person; the manager always sees both.
    canSeePurchasePrice: boolean("can_see_purchase_price").notNull().default(false),
    canSeeProfit: boolean("can_see_profit").notNull().default(false),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    lastSignOutAt: timestamp("last_sign_out_at", { withTimezone: true }),
    // «فاکتور ۶ را تأیید کرد» — the newest thing this person did.
    lastAction: text("last_action").notNull().default(""),
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // «حذف» by the manager. A deleted seller is also inactive.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  // One person per mobile among staff who are not deleted.
  (t) => [uniqueIndex("staff_users_mobile_live").on(t.mobile).where(sql`${t.deletedAt} is null`)],
);

export const staffSessions = pgTable("staff_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staffUsers.id, { onDelete: "cascade" }),
  // sha256 of the random cookie value; the cookie itself is never stored.
  tokenHash: text("token_hash").notNull().unique(),
  // Moves forward while the person works; 6 hours without a move ends the session.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Wrong passwords per typed mobile (known or not). 5 within 15 minutes close sign-in for that mobile. */
export const staffSignInFailures = pgTable(
  "staff_sign_in_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mobile: text("mobile").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_sign_in_failures_mobile_idx").on(t.mobile, t.at)],
);

export type StaffUser = typeof staffUsers.$inferSelect;
