// How prices look everywhere: digits in groups of three with «/», as Alireza asked
// («۱۲/۰۰۰/۰۰۰»). Pure; safe in client components.

/** «۱۲/۰۰۰/۰۰۰» — Persian digits, groups of three. */
export function groupFa(n: number): string {
  return n.toLocaleString("fa-IR").replace(/٬/g, "/");
}

/** «12/000/000» — for price boxes staff type in (Latin digits, left to right). */
export function groupAscii(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, "/");
}

/** Keeps only the digits of what was typed; Persian and Arabic digits become Latin. */
export function digitsOnly(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
}
