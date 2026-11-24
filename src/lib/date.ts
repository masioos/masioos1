// Dates as staff and shoppers read them. Pure; safe in client components.

/** «۲ آذر ۱۴۰۵، ۱۳:۴۵» in Tehran time. */
export function faDateTime(d: Date): string {
  return d.toLocaleString("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
