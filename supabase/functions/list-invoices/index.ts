// Returns the most recent invoices for the org's Stripe customer.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const organizationId = body.organizationId as string;
    const env = (body.environment || "sandbox") as StripeEnv;
    if (!organizationId) return json({ error: "organizationId required" }, 400);

    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return json({ error: "Forbidden" }, 403);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return json({ invoices: [] });

    const stripe = createStripeClient(env);
    const list = await stripe.invoices.list({ customer: sub.stripe_customer_id, limit: 12 });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      period_start: inv.period_start,
      period_end: inv.period_end,
    }));
    return json({ invoices });
  } catch (e) {
    console.error("list-invoices error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
