// payments-webhook — Stripe event processor.
//
// Hardened semantics:
//   * IDEMPOTENT: every successfully processed event id is recorded in
//     stripe_webhook_events; redeliveries become no-ops.
//   * RETRYABLE: database failures return 500 so Stripe redelivers, instead
//     of returning 200 and silently losing a paid upgrade.
//   * OBSERVABLE: unmapped plans and unresolvable orgs write an alert row to
//     n8n_error_log (admin-visible) instead of vanishing into function logs.

import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type PlanTier = "starter" | "launch" | "operate" | "scale";

function lookupKeyToPlan(key?: string | null): PlanTier | null {
  if (!key) return null;
  const k = key.toLowerCase();
  if (k.startsWith("launch")) return "launch";
  if (k.startsWith("operate")) return "operate";
  if (k.startsWith("scale")) return "scale";
  if (k.startsWith("starter")) return "starter";
  return null;
}

/** Permanent, non-retryable problem worth a human's attention. */
async function alertOps(summary: string, detail: Record<string, unknown>) {
  await supabase
    .from("n8n_error_log")
    .insert({
      workflow_name: "payments-webhook",
      error_message: summary,
      error_node: JSON.stringify(detail).slice(0, 1000),
    })
    .then(
      () => {},
      (e: unknown) => console.error("alertOps failed:", e),
    );
}

class RetryableError extends Error {}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const envParam = url.searchParams.get("env") ?? "sandbox";
  if (envParam !== "sandbox" && envParam !== "live") {
    return new Response("Invalid env parameter", { status: 400 });
  }
  const env = envParam as StripeEnv;

  let eventId = "";
  let eventType = "";
  try {
    const event = await verifyWebhook(req, env);
    eventId = event.id;
    eventType = event.type;
    console.log("Stripe event:", event.type, event.id, "env:", env);

    // ── Idempotency: drop redeliveries of already-processed events ────────
    const { data: seen } = await supabase
      .from("stripe_webhook_events")
      .select("id")
      .eq("event_id", event.id)
      .maybeSingle();
    if (seen) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;
      case "customer.subscription.deleted":
        await cancelSubscription(event.data.object);
        break;
      case "invoice.payment_failed":
        await markPastDue(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await clearPastDue(event.data.object);
        break;
      default:
        console.log("Unhandled:", event.type);
    }

    // Record success — only successful processing enters the ledger, so a
    // failed attempt stays retryable.
    const { error: ledgerErr } = await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      status: "processed",
    });
    if (ledgerErr) console.error("webhook ledger insert failed:", ledgerErr.message);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", eventType, eventId, e);
    if (e instanceof RetryableError) {
      // 500 → Stripe retries with backoff; the paid state is not lost.
      return new Response("Temporary processing failure", { status: 500 });
    }
    // Signature/parse failures: 400, Stripe will not retry garbage.
    return new Response("Webhook error", { status: 400 });
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncSubscription(obj: any) {
  const subscriptionId: string | undefined = obj.subscription || obj.id;
  const customerId: string | undefined = obj.customer;
  const status: string = obj.status || "active";
  const currentPeriodEnd: number | null = obj.current_period_end ?? null;
  const cancelAtPeriodEnd: boolean = obj.cancel_at_period_end ?? false;
  const metadata = obj.metadata || {};
  let lookupKey: string | undefined = metadata.priceLookupKey;
  let organizationId: string | undefined = metadata.organizationId;

  const item = obj.items?.data?.[0];
  if (item?.price) {
    lookupKey =
      lookupKey ||
      item.price.lookup_key ||
      item.price.metadata?.lovable_external_id ||
      item.price.metadata?.priceLookupKey;
  }

  // Fall back to resolving the org through the Stripe customer id before
  // giving up — metadata goes missing on some subscription.updated events.
  if (!organizationId && customerId) {
    const { data: byCustomer } = await supabase
      .from("subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    organizationId = (byCustomer?.organization_id as string | undefined) ?? undefined;
  }

  if (!organizationId) {
    await alertOps("Stripe event had no resolvable organization — manual review needed", {
      subscriptionId,
      customerId,
      lookupKey,
    });
    return; // permanent: retrying won't add metadata
  }

  const plan = lookupKeyToPlan(lookupKey);
  if (!plan && lookupKey) {
    await alertOps("Unmapped Stripe lookup_key — plan NOT updated", {
      lookupKey,
      organizationId,
      subscriptionId,
    });
  }

  const update: Record<string, unknown> = {
    status,
    stripe_subscription_id: subscriptionId ?? null,
    stripe_customer_id: customerId ?? null,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    cancel_at_period_end: cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  };
  if (plan) update.plan = plan;

  const { error, count } = await supabase
    .from("subscriptions")
    .update(update, { count: "exact" })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("subscriptions update failed", error);
    throw new RetryableError(error.message);
  }
  if (count === 0) {
    // Race: webhook arrived before the subscription row exists. Create it so
    // the paid plan is never lost.
    const { error: insertErr } = await supabase.from("subscriptions").insert({
      organization_id: organizationId,
      plan: plan ?? "starter",
      status,
      stripe_subscription_id: subscriptionId ?? null,
      stripe_customer_id: customerId ?? null,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    if (insertErr) {
      console.error("subscriptions insert fallback failed", insertErr);
      throw new RetryableError(insertErr.message);
    }
  }
  console.log("Synced", { plan, organizationId, status });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cancelSubscription(obj: any) {
  const organizationId = obj.metadata?.organizationId;
  if (!organizationId) {
    await alertOps("subscription.deleted without organizationId metadata", {
      subscription: obj.id,
      customer: obj.customer,
    });
    return;
  }
  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan: "starter",
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  if (error) throw new RetryableError(error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markPastDue(invoice: any) {
  const customerId = invoice.customer;
  if (!customerId) return;
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
  if (error) throw new RetryableError(error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function clearPastDue(invoice: any) {
  const customerId = invoice.customer;
  if (!customerId) return;
  // Only flip back to active if currently past_due
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId)
    .eq("status", "past_due");
  if (error) throw new RetryableError(error.message);
}
