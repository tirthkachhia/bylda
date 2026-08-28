import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CALLBACK_URL,
  OAUTH_PROVIDERS,
  clientCredentials,
  pkceVerifier,
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
  oauth_code_verifier: string | null;
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
  stripe_user_id?: string;
  dc?: string;
  accountname?: string;
  api_endpoint?: string;
  login?: string | { login_id?: string; login_name?: string; email?: string };
  id?: number | string;
  name?: string;
  html_url?: string;
  email?: string;
  sub?: string;
  atlassian_site?: { id?: string; name?: string; url?: string };
  asana_user?: { gid?: string; name?: string; email?: string };
  airtable_user?: { id?: string; email?: string };
  owner?: { user?: { id?: string; name?: string } };
  instance_url?: string;
  api_domain?: string;
  hub_id?: number | string;
};

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

function tokenRequest(
  provider: OAuthProvider,
  code: string,
  clientId: string,
  clientSecret: string,
  codeVerifier?: string | null,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type":
      provider.tokenBody === "json" ? "application/json" : "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams();

  if (provider.tokenAuth === "basic") {
    headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  } else if (provider.tokenAuth === "basic_url") {
    const credentials = btoa(`${clientId}:${clientSecret}`)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    headers.Authorization = `Basic ${credentials}`;
  } else if (provider.tokenFieldStyle === "gohighlevel") {
    body.set("clientId", clientId);
    body.set("clientSecret", clientSecret);
  } else if (provider.tokenFieldStyle === "stripe") {
    body.set("client_secret", clientSecret);
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
    if (provider.tokenFieldStyle !== "stripe") body.set("redirect_uri", CALLBACK_URL);
  }
  body.set("code", code);
  if (codeVerifier) body.set("code_verifier", codeVerifier);
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
  if (provider === "stripe") {
    return {
      id: String(payload.stripe_user_id ?? ""),
      label: payload.stripe_user_id ? `Stripe account ${payload.stripe_user_id}` : "Stripe account",
    };
  }
  if (provider === "mailchimp") {
    const login = typeof payload.login === "object" ? payload.login : undefined;
    return {
      id: String(login?.login_id ?? payload.dc ?? ""),
      label: String(payload.accountname ?? login?.login_name ?? "Mailchimp account"),
    };
  }
  if (provider === "github") {
    const login = typeof payload.login === "string" ? payload.login : "";
    return {
      id: String(payload.id ?? login),
      label: String(login || payload.name || "GitHub account"),
    };
  }
  if (provider === "jira") {
    return {
      id: String(payload.atlassian_site?.id ?? ""),
      label: String(payload.atlassian_site?.name ?? "Jira site"),
    };
  }
  if (provider === "asana") {
    return {
      id: String(payload.asana_user?.gid ?? ""),
      label: String(payload.asana_user?.name ?? "Asana account"),
    };
  }
  if (provider === "google") {
    return {
      id: String(payload.sub ?? payload.email ?? ""),
      label: String(payload.email ?? payload.name ?? "Google account"),
    };
  }
  if (provider === "airtable") {
    return {
      id: String(payload.airtable_user?.id ?? ""),
      label: String(payload.airtable_user?.email ?? "Airtable account"),
    };
  }
  if (provider === "salesforce") {
    return {
      id: String(payload.instance_url ?? payload.id ?? ""),
      label: payload.instance_url ? `Salesforce ${payload.instance_url}` : "Salesforce account",
    };
  }
  if (provider === "hubspot") {
    return {
      id: String(payload.hub_id ?? payload.organization_id ?? ""),
      label: payload.hub_id ? `HubSpot portal ${payload.hub_id}` : "HubSpot account",
    };
  }
  if (provider === "close") {
    return {
      id: String(payload.organization_id ?? payload.id ?? ""),
      label: "Close account",
    };
  }
  if (provider === "pipedrive") {
    return {
      id: String(payload.api_domain ?? payload.organization_id ?? ""),
      label: String(payload.api_domain ?? "Pipedrive account"),
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
    .select(
      "id,user_id,provider,integration_key,requested_scopes,oauth_code_verifier,redirect_to,expires_at,used_at",
    )
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

  const codeVerifier =
    oauthState.provider === "salesforce"
      ? await pkceVerifier(state, clientSecret)
      : oauthState.oauth_code_verifier;
  const request = tokenRequest(provider, code, clientId, clientSecret, codeVerifier);
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

  let providerPayload = payload;
  if (oauthState.provider === "mailchimp") {
    const metadataResponse = await fetch("https://login.mailchimp.com/oauth2/metadata", {
      headers: { Accept: "application/json", Authorization: `OAuth ${accessToken}` },
    });
    const metadata = (await metadataResponse.json().catch(() => ({}))) as TokenPayload;
    if (!metadataResponse.ok || !metadata.dc) {
      console.error("[integration-oauth-callback] mailchimp metadata", metadataResponse.status);
      return appRedirect(
        { oauth: "error", reason: "account_metadata_failed" },
        oauthState.redirect_to,
      );
    }
    providerPayload = { ...payload, ...metadata };
  }
  if (oauthState.provider === "github") {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Bylda",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const githubUser = (await userResponse.json().catch(() => ({}))) as TokenPayload;
    if (!userResponse.ok || typeof githubUser.login !== "string") {
      console.error("[integration-oauth-callback] github user", userResponse.status);
      return appRedirect(
        { oauth: "error", reason: "account_metadata_failed" },
        oauthState.redirect_to,
      );
    }
    providerPayload = { ...payload, ...githubUser };
  }
  if (oauthState.provider === "jira") {
    const resourcesResponse = await fetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      { headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` } },
    );
    const resources = (await resourcesResponse.json().catch(() => [])) as Array<{
      id?: string;
      name?: string;
      url?: string;
    }>;
    if (!resourcesResponse.ok || !resources[0]?.id) {
      console.error("[integration-oauth-callback] jira resources", resourcesResponse.status);
      return appRedirect(
        { oauth: "error", reason: "account_metadata_failed" },
        oauthState.redirect_to,
      );
    }
    providerPayload = { ...payload, atlassian_site: resources[0] };
  }
  if (oauthState.provider === "asana") {
    const userResponse = await fetch("https://app.asana.com/api/1.0/users/me", {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    const userPayload = (await userResponse.json().catch(() => ({}))) as {
      data?: { gid?: string; name?: string; email?: string };
    };
    if (!userResponse.ok || !userPayload.data?.gid) {
      console.error("[integration-oauth-callback] asana user", userResponse.status);
      return appRedirect(
        { oauth: "error", reason: "account_metadata_failed" },
        oauthState.redirect_to,
      );
    }
    providerPayload = { ...payload, asana_user: userPayload.data };
  }
  if (oauthState.provider === "google") {
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    const googleUser = (await userResponse.json().catch(() => ({}))) as TokenPayload;
    if (!userResponse.ok || !googleUser.sub) {
      console.error("[integration-oauth-callback] google user", userResponse.status);
      return appRedirect(
        { oauth: "error", reason: "account_metadata_failed" },
        oauthState.redirect_to,
      );
    }
    providerPayload = { ...payload, ...googleUser };
  }
  if (oauthState.provider === "airtable") {
    const userResponse = await fetch("https://api.airtable.com/v0/meta/whoami", {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    const airtableUser = (await userResponse.json().catch(() => ({}))) as {
      id?: string;
      email?: string;
    };
    if (!userResponse.ok || !airtableUser.id) {
      console.error("[integration-oauth-callback] airtable user", userResponse.status);
      return appRedirect(
        { oauth: "error", reason: "account_metadata_failed" },
        oauthState.redirect_to,
      );
    }
    providerPayload = { ...payload, airtable_user: airtableUser };
  }

  const expiresIn = Number(providerPayload.expires_in ?? providerPayload.expiresIn ?? 0);
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const scopes = String(providerPayload.scope ?? oauthState.requested_scopes.join(" "))
    .split(/[ ,]+/)
    .filter(Boolean);
  const account = accountMetadata(oauthState.provider, providerPayload);
  const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
  if (!encKey) return appRedirect({ oauth: "error", reason: "storage_not_configured" });

  const normalizedPayload = JSON.stringify({
    provider: oauthState.provider,
    access_token: accessToken,
    refresh_token: providerPayload.refresh_token ?? providerPayload.refreshToken ?? null,
    token_type: providerPayload.token_type ?? "Bearer",
    expires_at: expiresAt,
    scope: scopes,
    external_account_id: account.id,
    location_id: providerPayload.locationId ?? null,
    company_id: providerPayload.companyId ?? null,
    instance_url: providerPayload.instance_url ?? null,
    identity_url: providerPayload.id ?? null,
    data_center: providerPayload.dc ?? null,
    api_endpoint: providerPayload.api_endpoint ?? null,
    instance_url: providerPayload.instance_url ?? null,
    api_domain: providerPayload.api_domain ?? null,
    hub_id: providerPayload.hub_id ?? null,
    cloud_id: providerPayload.atlassian_site?.id ?? null,
    site_url: providerPayload.atlassian_site?.url ?? null,
    user_id: providerPayload.asana_user?.gid ?? providerPayload.sub ?? null,
    account_email: providerPayload.asana_user?.email ?? providerPayload.email ?? null,
    airtable_user_id: providerPayload.airtable_user?.id ?? null,
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
