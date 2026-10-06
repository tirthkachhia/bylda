import type { AuditEntry, Invoice, UsageMeter } from "@/lib/data";
export function displayDate(value: string | null, withTime = false): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Not available";
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: withTime ? undefined : "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    timeZone: "UTC",
  }).format(date);
  return withTime ? formatted.replace(", ", " ") : formatted;
}
export function invoiceAmount(invoice: Invoice): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency.toUpperCase(),
    }).format(invoice.amountCents / 100);
  } catch {
    return `${invoice.amountCents / 100} ${invoice.currency}`;
  }
}
export function safeInvoiceUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function usageValue(item: UsageMeter | undefined): string {
  if (!item) return "—";
  return `${item.used.toLocaleString("en-US")}${item.limit === null ? "" : ` of ${item.limit.toLocaleString("en-US")}`}`;
}
/** Protect spreadsheet consumers from formula evaluation while retaining quotes/newlines. */
function csvCell(value: string): string {
  // eslint-disable-next-line no-control-regex -- Skip leading controls before checking spreadsheet formulas.
  const leading = value.replace(/^[\s\u0000-\u001f]+/u, "");
  const safe = /^[=+@-]/u.test(leading) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function auditCsv(entries: AuditEntry[]): string {
  return [
    ["When (UTC)", "Who", "Action", "Target"],
    ...entries.map((item) => [item.createdAt, item.actorName, item.action, item.entity]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
export function sortedAudit(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
