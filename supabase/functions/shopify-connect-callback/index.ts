import { createClient } from "npm:@supabase/supabase-js@2";
import { sha256 } from "../_shared/integration-oauth.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.usebylda.com";
const allowedRedirectOrigins = new Set([
  new URL(APP_URL).origin,
  "https://bylda-eight.vercel.app",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
]);

function appRedirect(params: Record<string, string>, path = "/app/integrations") {
  const candidate = new URL(path, APP_URL);
  const target = allowedRedirectOrigins.has(candidate.origin)
    ? candidate
    : new URL("/app/integrations", APP_URL);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return Response.redirect(target.toString(), 302);
}

function normalizeShop(value: string) {
  const hostname = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(hostname) ? hostname : null;
}

async function validHmac(url: URL, secret: string) {
  const provided = url.searchParams.get("hmac") ?? "";
  const message = [...url.searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const expected = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const shop = normalizeShop(url.searchParams.get("shop") ?? "");
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";
  if (!state || !code || !shop || !clientId || !clientSecret) {
    return appRedirect({ oauth: "error", reason: "invalid_callback" });
  }
  if (!(await validHmac(url, clientSecret))) {
    return appRedirect({ oauth: "error", reason: "invalid_signature" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: oauthState, error } = await admin
    .from("integration_oauth_states")
    .select("id,user_id,requested_scopes,redirect_to,expires_at,used_at")
    .eq("state_hash", await sha256(state))
    .eq("provider", "shopify")
    .maybeSingle();
  if (
    error ||
    !oauthState ||
    oauthState.used_at ||
    new Date(oauthState.expires_at).getTime() < Date.now()
  ) {
    return appRedirect({ oauth: "error", reason: "invalid_state" });
  }
  const { data: consumedState } = await admin
    .from("integration_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", oauthState.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (!consumedState) return appRedirect({ oauth: "error", reason: "invalid_state" });

  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    return appRedirect({ oauth: "error", reason: "token_exchange_failed" }, oauthState.redirect_to);
  }

  const shopResponse = await fetch(`https://${shop}/admin/api/2026-07/shop.json`, {
    headers: { "X-Shopify-Access-Token": token.access_token },
  });
  const shopPayload = await shopResponse.json().catch(() => ({}));
  const account = shopPayload.shop ?? {};
  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encKey) {
    return appRedirect(
      { oauth: "error", reason: "storage_not_configured" },
      oauthState.redirect_to,
    );
  }

  const scopes = String(token.scope ?? oauthState.requested_scopes.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const { error: saveError } = await admin.rpc("set_oauth_integration", {
    _user_id: oauthState.user_id,
    _integration_key: "shopify",
    _token_payload: JSON.stringify({
      provider: "shopify",
      access_token: token.access_token,
      shop,
      scope: scopes,
      connected_at: new Date().toISOString(),
    }),
    _account_label: String(account.name ?? shop),
    _external_account_id: String(account.id ?? shop),
    _scopes: scopes,
    _token_expires_at: null,
    _encryption_key: encKey,
  });
  if (saveError) {
    console.error("[shopify-connect-callback] save", saveError.message);
    return appRedirect({ oauth: "error", reason: "save_failed" }, oauthState.redirect_to);
  }
  return appRedirect({ oauth: "success", provider: "shopify" }, oauthState.redirect_to);
});
