// Manage an existing Stripe subscription: cancel at period end, resume,
// switch plan, or open a Stripe Billing Portal session.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Action = "cancel_at_period_end" | "resume" | "switch_plan" | "billing_portal";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const action = body.action as Action;
    const organizationId = body.organizationId as string | undefined;
    const newPriceLookupKey = body.newPriceLookupKey as string | undefined;
    const returnUrl = body.returnUrl as string | undefined;
    const env = (body.environment || "sandbox") as StripeEnv;

    if (!organizationId) return json({ error: "organizationId required" }, 400);

    // Verify the user is owner/admin of the org
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id, plan, status")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const stripe = createStripeClient(env);

    // ----------------------------------------------------------------
    // Billing Portal — lets users update payment method, view invoices
    // ----------------------------------------------------------------
    if (action === "billing_portal") {
      if (!sub?.stripe_customer_id) {
        return json({ error: "No Stripe customer found for this organization" }, 404);
      }
      const origin = req.headers.get("origin") || "https://app.bylda.ai";
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: returnUrl || `${origin}/app/billing`,
      });
      return json({ url: session.url });
    }

    if (!sub?.stripe_subscription_id) {
      return json({ error: "No active Stripe subscription" }, 404);
    }

    if (action === "cancel_at_period_end") {
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          current_period_end: updated.current_period_end
            ? new Date(updated.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId);
      return json({ ok: true });
    }

    if (action === "resume") {
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          current_period_end: updated.current_period_end
            ? new Date(updated.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId);
      return json({ ok: true });
    }

    if (action === "switch_plan") {
      if (!newPriceLookupKey) return json({ error: "newPriceLookupKey required" }, 400);
      const prices = await stripe.prices.list({ lookup_keys: [newPriceLookupKey] });
      if (!prices.data.length) return json({ error: "Price not found" }, 404);
      const stripePrice = prices.data[0];

      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const itemId = current.items.data[0]?.id;
      if (!itemId) return json({ error: "Subscription item missing" }, 500);

      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: itemId, price: stripePrice.id }],
        proration_behavior: "create_prorations",
        metadata: {
          ...(current.metadata || {}),
          priceLookupKey: newPriceLookupKey,
        },
      });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-subscription error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
