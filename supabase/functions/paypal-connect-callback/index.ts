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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const merchantId = url.searchParams.get("merchantIdInPayPal") ?? "";
  const permissionsGranted = url.searchParams.get("permissionsGranted") === "true";
  const accountStatus = url.searchParams.get("accountStatus") ?? "";
  if (!state) return appRedirect({ oauth: "error", reason: "missing_state" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: oauthState, error } = await admin
    .from("integration_oauth_states")
    .select("id,user_id,integration_key,redirect_to,expires_at,used_at")
    .eq("state_hash", await sha256(state))
    .eq("provider", "paypal")
    .maybeSingle();
  if (
    error ||
    !oauthState ||
    oauthState.used_at ||
    new Date(oauthState.expires_at).getTime() < Date.now()
  ) {
    return appRedirect({ oauth: "error", reason: "invalid_state" });
  }

  const { data: consumedState, error: consumeError } = await admin
    .from("integration_oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", oauthState.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (consumeError || !consumedState) {
    return appRedirect({ oauth: "error", reason: "invalid_state" });
  }
  if (!merchantId) {
    return appRedirect({ oauth: "cancelled", provider: "paypal" }, oauthState.redirect_to);
  }
  if (!permissionsGranted) {
    return appRedirect(
      { oauth: "error", reason: "permissions_not_granted", provider: "paypal" },
      oauthState.redirect_to,
    );
  }

  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encKey) {
    return appRedirect(
      { oauth: "error", reason: "storage_not_configured" },
      oauthState.redirect_to,
    );
  }

  const tokenPayload = JSON.stringify({
    provider: "paypal",
    merchant_id: merchantId,
    permissions_granted: permissionsGranted,
    account_status: accountStatus || null,
    connected_at: new Date().toISOString(),
  });
  const { error: saveError } = await admin.rpc("set_oauth_integration", {
    _user_id: oauthState.user_id,
    _integration_key: "paypal",
    _token_payload: tokenPayload,
    _account_label: `PayPal merchant ${merchantId}`,
    _external_account_id: merchantId,
    _scopes: ["SHARE_DATA_CONSENT"],
    _token_expires_at: null,
    _encryption_key: encKey,
  });
  if (saveError) {
    console.error("[paypal-connect-callback] save", saveError.message);
    return appRedirect({ oauth: "error", reason: "save_failed" }, oauthState.redirect_to);
  }

  return appRedirect({ oauth: "success", provider: "paypal" }, oauthState.redirect_to);
});
