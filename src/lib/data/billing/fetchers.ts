import { invokeEdge } from "@/lib/invokeEdge";
import { subscriptionQuery, usageQuery } from "@/lib/queries";
import { getStripeEnvironment } from "@/lib/stripe";

const run = async <T>(q: { queryKey: readonly unknown[]; queryFn?: unknown }): Promise<T> =>
  (q.queryFn as (ctx: unknown) => Promise<T>)({
    queryKey: q.queryKey,
    signal: new AbortController().signal,
    meta: undefined,
  });

/** REAL — existing wrappers. */
export const fetchSubscription = (orgId: string) =>
  run<{
    plan: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null>(subscriptionQuery(orgId));
export const fetchUsage = (orgId: string) =>
  run<{ tool_key: string; count: number; period: string }[]>(usageQuery(orgId));
export const fetchInvoices = (orgId: string) =>
  invokeEdge<{
    invoices?: {
      id: string;
      number: string | null;
      amount_paid: number;
      currency: string;
      status: string | null;
      created: number;
      hosted_invoice_url: string | null;
    }[];
  }>("list-invoices", { organizationId: orgId, environment: getStripeEnvironment() });
