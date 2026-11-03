import {
  requireCoachingAdmin,
  coachingCors,
  coachingJson as json,
} from "../_shared/coaching/admin-access.ts";
import Stripe from "npm:stripe@18.5.0";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: coachingCors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null),
    auth = await requireCoachingAdmin(req, body?.organization_id);
  if (!auth.ok) return auth.response;
  try {
    const key = Deno.env.get(
      body.environment === "live" ? "STRIPE_LIVE_API_KEY" : "STRIPE_SANDBOX_API_KEY",
    );
    if (!key) throw new Error("Stripe is not configured");
    const stripe = new Stripe(key);
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      limit: 100,
      expand: ["data.product"],
    });
    return json({
      prices: prices.data
        .filter((p) => p.lookup_key && p.unit_amount !== null)
        .map((p) => ({
          lookup_key: p.lookup_key,
          name:
            typeof p.product === "object" && "name" in p.product ? p.product.name : p.lookup_key,
          amount: p.unit_amount,
          currency: p.currency,
          interval: p.recurring?.interval,
          interval_count: p.recurring?.interval_count,
        })),
    });
  } catch {
    return json(
      {
        error:
          "Configured billing prices could not load. Check the Stripe environment and credentials.",
      },
      503,
    );
  }
});
