// bylda-stripe-api
// POST /api/create-checkout-session — create Stripe Checkout session
// POST /api/stripe/webhook          — handle Stripe webhook events

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_49: string;
  STRIPE_PRICE_149: string;
  STRIPE_PRICE_299: string;
}

const ALLOWED_ORIGIN = "https://app.usebylda.com";
const SUCCESS_URL = "https://app.usebylda.com/app/billing?success=true";
const CANCEL_URL = "https://app.usebylda.com/app/billing";

// Plan slug mapping (price_id → plan slug, for webhook)
const PLAN_SLUG_BY_PRICE_KEY: Record<string, string> = {
  STRIPE_PRICE_49: "launch",
  STRIPE_PRICE_149: "scale",
  STRIPE_PRICE_299: "enterprise",
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function validateJWT(token: string, env: Env): Promise<{ sub: string } | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string };
    return { sub: user.id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stripe API helpers
// ---------------------------------------------------------------------------
function stripeHeaders(env: Env): Record<string, string> {
  return {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function encodeFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function createCheckoutSession(
  priceId: string,
  userId: string,
  env: Env,
): Promise<{ url: string; id: string } | null> {
  const params: Record<string, string> = {
    "payment_method_types[]": "card",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    mode: "subscription",
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    client_reference_id: userId,
    "subscription_data[metadata][user_id]": userId,
  };

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: stripeHeaders(env),
    body: encodeFormBody(params),
  });

  if (!res.ok) return null;
  const session = (await res.json()) as { url: string; id: string };
  return session;
}

// ---------------------------------------------------------------------------
// Stripe webhook signature verification (manual HMAC-SHA256)
// ---------------------------------------------------------------------------
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      acc[k] = v;
      return acc;
    }, {});

    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(signedPayload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computedSig = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedSig === signature;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
function sbHeaders(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

// Map Stripe price ID back to plan slug
function getPlanSlugFromPriceId(priceId: string, env: Env): string {
  if (priceId === env.STRIPE_PRICE_49) return "launch";
  if (priceId === env.STRIPE_PRICE_149) return "scale";
  if (priceId === env.STRIPE_PRICE_299) return "enterprise";
  return "starter";
}

async function handleCheckoutCompleted(session: StripeCheckoutSession, env: Env): Promise<void> {
  const userId = session.client_reference_id;
  if (!userId) return;

  // Determine plan from subscription's price
  const priceId = session.subscription
    ? await getSubscriptionPriceId(session.subscription as string, env)
    : null;

  const planSlug = priceId ? getPlanSlugFromPriceId(priceId, env) : "launch";
  const planTier = planSlug;

  // Get user's organization
  const orgRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id&limit=1`,
    { headers: sbHeaders(env) },
  );
  const orgs = (await orgRes.json()) as Array<{ organization_id: string }>;
  const orgId = orgs[0]?.organization_id;

  if (!orgId) {
    console.error(`No org found for user ${userId}`);
    return;
  }

  // Upsert subscription record
  await fetch(`${env.SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...sbHeaders(env), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      organization_id: orgId,
      user_id: userId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      plan_tier: planTier,
      plan_slug: planSlug,
      status: "active",
      updated_at: new Date().toISOString(),
    }),
  });

  // Update organization plan
  await fetch(`${env.SUPABASE_URL}/rest/v1/organizations?id=eq.${orgId}`, {
    method: "PATCH",
    headers: { ...sbHeaders(env), Prefer: "return=representation" },
    body: JSON.stringify({ plan_tier: planTier, updated_at: new Date().toISOString() }),
  });
}

async function getSubscriptionPriceId(subscriptionId: string, env: Env): Promise<string | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) return null;
    const sub = (await res.json()) as { items: { data: Array<{ price: { id: string } }> } };
    return sub.items?.data?.[0]?.price?.id ?? null;
  } catch {
    return null;
  }
}

async function handleSubscriptionDeleted(
  subscription: StripeSubscription,
  env: Env,
): Promise<void> {
  const stripeSubId = subscription.id;

  // Find subscription in Supabase
  const subRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}&select=organization_id,user_id`,
    { headers: sbHeaders(env) },
  );
  const subs = (await subRes.json()) as Array<{ organization_id: string; user_id: string }>;
  if (!subs.length) return;

  const { organization_id: orgId } = subs[0];

  // Update subscription status
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}`,
    {
      method: "PATCH",
      headers: sbHeaders(env),
      body: JSON.stringify({
        plan_tier: "starter",
        status: "cancelled",
        updated_at: new Date().toISOString(),
      }),
    },
  );

  // Downgrade organization
  await fetch(`${env.SUPABASE_URL}/rest/v1/organizations?id=eq.${orgId}`, {
    method: "PATCH",
    headers: sbHeaders(env),
    body: JSON.stringify({ plan_tier: "starter", updated_at: new Date().toISOString() }),
  });
}

// ---------------------------------------------------------------------------
// Type definitions for Stripe events
// ---------------------------------------------------------------------------
interface StripeCheckoutSession {
  id: string;
  object: "checkout.session";
  client_reference_id: string | null;
  customer: string | null;
  subscription: string | null;
  payment_status: string;
}

interface StripeSubscription {
  id: string;
  object: "subscription";
  customer: string;
  status: string;
  items: { data: Array<{ price: { id: string } }> };
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleCreateCheckout(request: Request, env: Env, origin: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const user = await validateJWT(token, env);
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(origin));
  }

  const body = (await request.json()) as { plan: "49" | "149" | "299" };
  const { plan } = body;

  const priceMap: Record<string, string> = {
    "49": env.STRIPE_PRICE_49,
    "149": env.STRIPE_PRICE_149,
    "299": env.STRIPE_PRICE_299,
  };

  const priceId = priceMap[plan];
  if (!priceId) {
    return jsonResponse(
      { error: "Invalid plan. Must be 49, 149, or 299." },
      400,
      corsHeaders(origin),
    );
  }

  const session = await createCheckoutSession(priceId, user.sub, env);
  if (!session) {
    return jsonResponse({ error: "Failed to create checkout session" }, 502, corsHeaders(origin));
  }

  return jsonResponse({ checkout_url: session.url }, 200, corsHeaders(origin));
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await request.text();
  const sigHeader = request.headers.get("Stripe-Signature") ?? "";

  const valid = await verifyStripeSignature(payload, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as StripeCheckoutSession;
      await handleCheckoutCompleted(session, env);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as StripeSubscription;
      await handleSubscriptionDeleted(subscription, env);
      break;
    }
    default:
      // Unhandled event type — acknowledge and ignore
      break;
  }

  return jsonResponse({ received: true });
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === "POST" && path === "/api/create-checkout-session") {
      return handleCreateCheckout(request, env, origin);
    }

    if (request.method === "POST" && path === "/api/stripe/webhook") {
      return handleWebhook(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404, corsHeaders(origin));
  },
};
