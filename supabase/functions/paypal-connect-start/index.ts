import { createClient } from "npm:@supabase/supabase-js@2";
import { randomState, sha256 } from "../_shared/integration-oauth.ts";

const CALLBACK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paypal-connect-callback`;
const allowedOrigins = new Set([
  Deno.env.get("APP_URL") ?? "https://app.usebylda.com",
  "https://bylda-eight.vercel.app",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : (Deno.env.get("APP_URL") ?? "https://app.usebylda.com"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json(req, { error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(req, { error: "Unauthorized" }, 401);

  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
  const environment = Deno.env.get("PAYPAL_ENV") === "live" ? "live" : "sandbox";
  if (!clientId || !clientSecret) {
    return json(
      req,
      {
        error: "PayPal sign-in is awaiting administrator configuration.",
        code: "OAUTH_NOT_CONFIGURED",
      },
      503,
    );
  }

  const apiBase =
    environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const tokenResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    console.error("[paypal-connect-start] token", tokenResponse.status);
    return json(req, { error: "Could not authenticate the PayPal connector." }, 502);
  }

  const state = randomState();
  const requestOrigin = req.headers.get("Origin") ?? "";
  const redirectTo = allowedOrigins.has(requestOrigin)
    ? `${requestOrigin}/app/integrations`
    : "/app/integrations";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error: stateError } = await admin.from("integration_oauth_states").insert({
    state_hash: await sha256(state),
    user_id: userData.user.id,
    provider: "paypal",
    integration_key: "paypal",
    requested_scopes: ["SHARE_DATA_CONSENT"],
    redirect_to: redirectTo,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateError) {
    console.error("[paypal-connect-start] state insert", stateError.message);
    return json(req, { error: "Could not start secure PayPal sign-in." }, 500);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${tokenPayload.access_token}`,
    "Content-Type": "application/json",
    "PayPal-Request-Id": crypto.randomUUID(),
  };
  const bnCode = Deno.env.get("PAYPAL_BN_CODE");
  if (bnCode) headers["PayPal-Partner-Attribution-Id"] = bnCode;

  const referralResponse = await fetch(`${apiBase}/v2/customer/partner-referrals`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tracking_id: userData.user.id,
      operations: [
        {
          operation: "API_INTEGRATION",
          api_integration_preference: {
            rest_api_integration: {
              integration_method: "PAYPAL",
              integration_type: "THIRD_PARTY",
              third_party_details: { features: ["PAYMENT", "REFUND"] },
            },
          },
        },
      ],
      products: [Deno.env.get("PAYPAL_PRODUCT") ?? "PPCP"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
      partner_config_override: {
        return_url: `${CALLBACK_URL}?state=${encodeURIComponent(state)}`,
        return_url_description: "Return to Bylda integrations",
      },
    }),
  });
  const referral = await referralResponse.json().catch(() => ({}));
  const authorizationUrl = referral.links?.find(
    (link: { rel?: string; href?: string }) => link.rel === "action_url",
  )?.href;
  if (!referralResponse.ok || !authorizationUrl) {
    console.error("[paypal-connect-start] referral", referralResponse.status, referral);
    return json(req, { error: "Could not create the PayPal connection." }, 502);
  }

  return json(req, { authorization_url: authorizationUrl, provider: "paypal" });
});
