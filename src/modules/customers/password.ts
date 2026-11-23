import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing with scrypt (built into Node; no package). Format: "scrypt:<salt>:<hash>".

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFC"), salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, saltHex, hashHex] = stored.split(":");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password.normalize("NFC"), Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
