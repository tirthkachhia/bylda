import { createClient } from "npm:@supabase/supabase-js@2";
import { randomState, sha256 } from "../_shared/integration-oauth.ts";

const CALLBACK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify-connect-callback`;
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

function normalizeShop(value: string) {
  const hostname = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0];
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(hostname) ? hostname : null;
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

  const body = await req.json().catch(() => null);
  const shop = normalizeShop(String(body?.shop ?? ""));
  if (!shop) return json(req, { error: "Enter a valid store.myshopify.com domain." }, 400);

  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    return json(req, { error: "Shopify sign-in is awaiting administrator configuration." }, 503);
  }

  const scopes = (Deno.env.get("SHOPIFY_SCOPES") ?? "read_products,read_orders")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
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
    provider: "shopify",
    integration_key: "shopify",
    requested_scopes: scopes,
    redirect_to: redirectTo,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateError) return json(req, { error: "Could not start secure Shopify sign-in." }, 500);

  const authorizationUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("scope", scopes.join(","));
  authorizationUrl.searchParams.set("redirect_uri", CALLBACK_URL);
  authorizationUrl.searchParams.set("state", state);
  return json(req, { authorization_url: authorizationUrl.toString(), provider: "shopify" });
});
