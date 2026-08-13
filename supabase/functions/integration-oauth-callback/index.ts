import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CALLBACK_URL,
  OAUTH_PROVIDERS,
  clientCredentials,
  sha256,
  type OAuthProvider,
  type OAuthProviderKey,
} from "../_shared/integration-oauth.ts";

type OAuthState = {
  id: string;
  user_id: string;
  provider: OAuthProviderKey;
  integration_key: string;
  requested_scopes: string[];
  redirect_to: string;
  expires_at: string;
  used_at: string | null;
};

type TokenPayload = Record<string, unknown> & {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  expires_in?: number;
  expiresIn?: number;
  scope?: string;
  locationId?: string;
  companyId?: string;
  team?: { id?: string; name?: string };
  workspace_id?: string;
  workspace_name?: string;
  organization_id?: string;
  instance_url?: string;
  id?: string;
  owner?: { user?: { id?: string; name?: string } };
};

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.usebylda.com";

function appRedirect(params: Record<string, string>, path = "/app/integrations") {
  const target = new URL(path.startsWith("/") ? path : "/app/integrations", APP_URL);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return Response.redirect(target.toString(), 302);
}

function tokenRequest(
  provider: OAuthProvider,
  code: string,
  clientId: string,
  clientSecret: string,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type":
      provider.tokenBody === "json" ? "application/json" : "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams();

  if (provider.tokenAuth === "basic") {
    headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  } else if (provider.tokenFieldStyle === "gohighlevel") {
    body.set("clientId", clientId);
    body.set("clientSecret", clientSecret);
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  if (provider.tokenFieldStyle === "gohighlevel") {
    body.set("grantType", "authorization_code");
    body.set("redirectUri", CALLBACK_URL);
    headers.Version = "v3";
  } else {
    body.set("grant_type", "authorization_code");
    body.set("redirect_uri", CALLBACK_URL);
  }
  body.set("code", code);
  return {
    headers,
    body:
      provider.tokenBody === "json"
        ? JSON.stringify(Object.fromEntries(body.entries()))
        : body.toString(),
  };
}

function accountMetadata(provider: OAuthProviderKey, payload: TokenPayload) {
  if (provider === "gohighlevel") {
    return {
      id: String(payload.locationId ?? payload.companyId ?? ""),
      label: payload.locationId ? `HighLevel location ${payload.locationId}` : "HighLevel account",
    };
  }
  if (provider === "slack") {
    return { id: String(payload.team?.id ?? ""), label: payload.team?.name ?? "Slack workspace" };
  }
  if (provider === "notion") {
    return {
      id: String(payload.workspace_id ?? payload.owner?.user?.id ?? ""),
      label: String(payload.workspace_name ?? payload.owner?.user?.name ?? "Notion workspace"),
    };
  }
  if (provider === "salesforce") {
    const identityParts =
      String(payload.id ?? "")
        .split("/id/")[1]
        ?.split("/") ?? [];
    const organizationId = String(payload.organization_id ?? identityParts[0] ?? "");
    return {
      id: organizationId,
      label: organizationId ? `Salesforce organization ${organizationId}` : "Salesforce account",
    };
  }
  return {
    id: String(payload.organization_id ?? ""),
    label: `${provider[0].toUpperCase()}${provider.slice(1)} account`,
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error");
  if (!state) return appRedirect({ oauth: "error", reason: "missing_state" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin
    .from("integration_oauth_states")
    .select("id,user_id,provider,integration_key,requested_scopes,redirect_to,expires_at,used_at")
    .eq("state_hash", await sha256(state))
    .maybeSingle();
  const oauthState = data as OAuthState | null;
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

  if (providerError || !code) {
    return appRedirect(
      { oauth: "cancelled", provider: oauthState.integration_key },
      oauthState.redirect_to,
    );
  }

  const provider = OAUTH_PROVIDERS[oauthState.provider];
  if (!provider) {
    return appRedirect(
      { oauth: "error", reason: "provider_not_supported" },
      oauthState.redirect_to,
    );
  }
  const { clientId, clientSecret } = clientCredentials(provider);
  if (!clientId || !clientSecret) {
    return appRedirect(
      { oauth: "error", reason: "provider_not_configured" },
      oauthState.redirect_to,
    );
  }

  const request = tokenRequest(provider, code, clientId, clientSecret);
  const tokenResponse = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });
  const payload = (await tokenResponse.json().catch(() => ({}))) as TokenPayload;
  const accessToken = payload.access_token ?? payload.accessToken;
  if (!tokenResponse.ok || !accessToken || payload.ok === false) {
    console.error(
      "[integration-oauth-callback] token exchange",
      oauthState.provider,
      tokenResponse.status,
    );
    return appRedirect({ oauth: "error", reason: "token_exchange_failed" }, oauthState.redirect_to);
  }

  const expiresIn = Number(payload.expires_in ?? payload.expiresIn ?? 0);
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const scopes = String(payload.scope ?? oauthState.requested_scopes.join(" "))
    .split(/[ ,]+/)
    .filter(Boolean);
  const account = accountMetadata(oauthState.provider, payload);
  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encKey) return appRedirect({ oauth: "error", reason: "storage_not_configured" });

  const normalizedPayload = JSON.stringify({
    provider: oauthState.provider,
    access_token: accessToken,
    refresh_token: payload.refresh_token ?? payload.refreshToken ?? null,
    token_type: payload.token_type ?? "Bearer",
    expires_at: expiresAt,
    scope: scopes,
    external_account_id: account.id,
    location_id: payload.locationId ?? null,
    company_id: payload.companyId ?? null,
    instance_url: payload.instance_url ?? null,
    identity_url: payload.id ?? null,
    connected_at: new Date().toISOString(),
  });

  const { error: saveError } = await admin.rpc("set_oauth_integration", {
    _user_id: oauthState.user_id,
    _integration_key: oauthState.integration_key,
    _token_payload: normalizedPayload,
    _account_label: account.label,
    _external_account_id: account.id,
    _scopes: scopes,
    _token_expires_at: expiresAt,
    _encryption_key: encKey,
  });
  if (saveError) {
    console.error("[integration-oauth-callback] save", saveError.message);
    return appRedirect({ oauth: "error", reason: "save_failed" }, oauthState.redirect_to);
  }

  if (oauthState.provider === "gohighlevel" && payload.locationId) {
    await admin.rpc("set_user_integration", {
      _user_id: oauthState.user_id,
      _integration_key: "gohighlevel_location",
      _value: String(payload.locationId),
      _encryption_key: encKey,
    });
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", oauthState.user_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membership?.organization_id) {
    const artifact = {
      org_id: membership.organization_id,
      user_id: oauthState.user_id,
      source_type: "integration",
      source_label: oauthState.integration_key,
      title: `${oauthState.integration_key} account connected`,
      content_preview: `${account.label} is connected to Bylda using delegated OAuth access.`,
      status: "indexed",
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await admin
      .from("memory_artifacts")
      .select("id")
      .eq("org_id", membership.organization_id)
      .eq("source_type", "integration")
      .eq("source_label", oauthState.integration_key)
      .maybeSingle();
    if (existing?.id) {
      await admin.from("memory_artifacts").update(artifact).eq("id", existing.id);
    } else {
      await admin
        .from("memory_artifacts")
        .insert({ ...artifact, created_at: new Date().toISOString() });
    }
  }

  return appRedirect(
    { oauth: "success", provider: oauthState.integration_key },
    oauthState.redirect_to,
  );
});
