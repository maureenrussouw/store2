// Tiny formatting library every business app rebuilds. Locale + default
// currency are configurable via setFormatConfig({...}) — call once at app
// boot from main.tsx.

interface FormatConfig {
  locale: string;
  currency: string;
}

let config: FormatConfig = {
  locale: "en-US",
  currency: "USD",
};

export function setFormatConfig(next: Partial<FormatConfig>) {
  config = { ...config, ...next };
}

// formatCurrency(4500000) -> "$4,500,000.00"
// formatCurrency(4500000, "UGX") -> "UGX 4,500,000"
//
// We pick "currency" style for known 2-decimal currencies and "decimal +
// prefix" for shilling-style currencies where the trailing .00 is noise.
const NO_DECIMAL_CURRENCIES = new Set(["UGX", "JPY", "KRW", "RWF", "TZS", "VND"]);

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency || config.currency;
  if (NO_DECIMAL_CURRENCIES.has(cur)) {
    const n = new Intl.NumberFormat(config.locale, { maximumFractionDigits: 0 }).format(amount);
    return cur + " " + n;
  }
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: cur,
  }).format(amount);
}

// formatDate(value, fmt?) — fmt defaults to "MMM d, yyyy".
// Accepts Date, ISO string, or millis. Empty/null returns "".
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(value: Date | string | number | null | undefined, fmt = "MMM d, yyyy"): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // Minimal token formatter — enough for the standard cases. Uses a
  // single-pass replace so "MMMM" (long month) wins over "MMM" (short).
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/yy/g, String(d.getFullYear()).slice(-2))
    .replace(/MMMM/g, MONTHS_LONG[d.getMonth()])
    .replace(/MMM/g, MONTHS_SHORT[d.getMonth()])
    .replace(/MM/g, String(d.getMonth() + 1).padStart(2, "0"))
    .replace(/dd/g, String(d.getDate()).padStart(2, "0"))
    .replace(/d/g, String(d.getDate()))
    .replace(/HH/g, String(d.getHours()).padStart(2, "0"))
    .replace(/mm/g, String(d.getMinutes()).padStart(2, "0"))
    .replace(/ss/g, String(d.getSeconds()).padStart(2, "0"));
}

// formatDateTime("2026-05-02T14:30:00Z") -> "May 2, 2026 · 2:30 PM"
export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = formatDate(d, "MMM d, yyyy");
  const time = new Intl.DateTimeFormat(config.locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return date + " · " + time;
}

// humanize("checked_in") -> "Checked in". Snake/kebab-case aware.
export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  const tokens = s
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  if (!tokens) return "";
  return tokens.charAt(0).toUpperCase() + tokens.slice(1);
}

// initials("Abu Seal") -> "AS". Up to 2 characters.
export function initials(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
