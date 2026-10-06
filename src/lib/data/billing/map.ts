import type { Invoice, Plan, UsageMeter } from "../types";

export const mapPlan = (
  s: {
    plan: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null,
): Plan => ({
  tier: s?.plan ?? "starter",
  status: (s?.status ?? "incomplete") as Plan["status"],
  periodEnd: s?.current_period_end ?? null,
  // GAP: seats — C-26b
  seats: null,
  seatsUsed: 0,
  cancelAtPeriodEnd: !!s?.cancel_at_period_end,
});
export const mapInvoice = (i: {
  id: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
}): Invoice => ({
  id: i.id,
  number: i.number ?? i.id,
  amountCents: i.amount_paid,
  currency: i.currency,
  status: i.status ?? "unknown",
  issuedAt: new Date(i.created * 1000).toISOString(),
  url: i.hosted_invoice_url,
});
export const mapUsage = (
  rows: { tool_key: string; count: number; period: string }[],
): UsageMeter[] =>
  rows.map((r) => ({
    key: r.tool_key,
    label: r.tool_key.replace(/[-_]/g, " "),
    used: r.count,
    limit: null,
    period: r.period,
  }));

/** C-32 · proposed subscriptions row after adding seat columns. */
export type SubscriptionV1Row = {
  organization_id: string;
  plan: string;
  status: Plan["status"];
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  seats: number | null;
  seats_used: number;
};
export const mapSubscriptionV1 = (r: SubscriptionV1Row): Plan => ({
  tier: r.plan,
  status: r.status,
  periodEnd: r.current_period_end,
  seats: r.seats,
  seatsUsed: r.seats_used,
  cancelAtPeriodEnd: r.cancel_at_period_end,
});
