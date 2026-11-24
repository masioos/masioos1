#!/usr/bin/env node
// `pnpm staff:manager <mobile> "<full name>"` — creates the shop manager, or gives the manager a
// new password if that mobile is already the manager. Prints the new password once.
// Run it on the server (or locally) where DATABASE_URL points at the shop's database.
// Same password format as src/lib/password.ts: "scrypt:<salt hex>:<hash hex>".

import { randomBytes, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import postgres from "postgres";

if (existsSync(".env")) process.loadEnvFile(".env");

const [rawMobile, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim();
const toLatin = (s) =>
  s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
let mobile = toLatin(rawMobile ?? "").replace(/[\s\-()+]/g, "");
if (/^0098\d{10}$/.test(mobile)) mobile = `0${mobile.slice(4)}`;
else if (/^98\d{10}$/.test(mobile)) mobile = `0${mobile.slice(2)}`;
else if (/^9\d{9}$/.test(mobile)) mobile = `0${mobile}`;
if (!/^09\d{9}$/.test(mobile)) {
  console.error('Usage: pnpm staff:manager 09121234567 "Full Name"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Same alphabet as src/modules/staff/rules.ts (no 0/o/1/l).
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const password = Array.from(randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join("");
const salt = randomBytes(16);
const hash = `scrypt:${salt.toString("hex")}:${scryptSync(password.normalize("NFC"), salt, 64).toString("hex")}`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [existing] = await sql`select id, role from staff_users where mobile = ${mobile}`;
  if (existing && existing.role !== "manager") {
    console.error("This mobile belongs to a seller. Use another mobile for the manager.");
    process.exit(1);
  }
  if (existing) {
    await sql`update staff_users set password_hash = ${hash}, is_active = true where id = ${existing.id}`;
    await sql`delete from staff_sessions where staff_id = ${existing.id}`;
    console.log(`✔ new password for the manager ${mobile}`);
  } else {
    const [other] = await sql`select id from staff_users where role = 'manager'`;
    if (other) {
      console.error("A manager already exists. Run this with the manager's mobile to give a new password.");
      process.exit(1);
    }
    if (fullName.length < 3) {
      console.error('Give the manager\'s full name: pnpm staff:manager 09121234567 "Full Name"');
      process.exit(1);
    }
    await sql`insert into staff_users (full_name, mobile, password_hash, role) values (${fullName}, ${mobile}, ${hash}, 'manager')`;
    console.log(`✔ manager created: ${fullName} ${mobile}`);
  }
  console.log(`  password (shown only now): ${password}`);
} finally {
  await sql.end();
}
