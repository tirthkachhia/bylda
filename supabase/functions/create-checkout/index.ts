import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const { priceId, quantity, organizationId, returnUrl, environment } = await req.json();

    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return json({ error: "Invalid priceId" }, 400);
    }
    if (!organizationId || typeof organizationId !== "string") {
      return json({ error: "organizationId required" }, 400);
    }

    // Verify caller is owner/admin of the supplied organization
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Trust the authenticated user's email/id, not whatever the client sent
    const customerEmail = user.email;
    const userId = user.id;

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) return json({ error: "Price not found" }, 404);
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      return_url:
        returnUrl ||
        `${req.headers.get("origin")}/app/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        userId,
        organizationId,
        priceLookupKey: priceId,
      },
      ...(isRecurring && {
        subscription_data: {
          metadata: {
            userId,
            organizationId,
            priceLookupKey: priceId,
          },
        },
      }),
    });

    return json({ clientSecret: session.client_secret });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
