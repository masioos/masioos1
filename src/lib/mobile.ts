// Iranian mobile numbers as typed by people. Pure; shared by shopper and staff sign-in.

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * An Iranian mobile as typed → "09xxxxxxxxx". Accepts Persian digits, spaces, dashes and the
 * +98 / 0098 / 98 prefixes. Returns the text unchanged-ish when it is not a mobile (the schema refuses it).
 */
export function normalizeMobile(input: string): string {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\s\-()+]/g, "");
  if (/^0098\d{10}$/.test(digits)) return `0${digits.slice(4)}`;
  if (/^98\d{10}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

export function isMobile(mobile: string): boolean {
  return /^09\d{9}$/.test(mobile);
}

/** Only same-site paths after sign-in, so a link cannot send someone to another website. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
