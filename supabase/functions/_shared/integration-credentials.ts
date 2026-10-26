import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { clientCredentials, OAUTH_PROVIDERS, type OAuthProviderKey } from "./integration-oauth.ts";

export type StoredOAuth = {
  integrationKey: string;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  instanceUrl: string | null;
  apiDomain: string | null;
  locationId: string | null;
  accountLabel: string | null;
  raw: Record<string, unknown>;
};

const INTEGRATION_TO_PROVIDER: Record<string, OAuthProviderKey> = {
  hubspot: "hubspot",
  gohighlevel: "gohighlevel",
  salesforce: "salesforce",
  close_io: "close",
  pipedrive: "pipedrive",
  notion: "notion",
  stripe: "stripe",
  mailchimp: "mailchimp",
};

export async function readIntegrationSecret(
  admin: SupabaseClient,
  userId: string,
  integrationKey: string,
  encryptionKey: string,
): Promise<string> {
  const { data, error } = await admin.rpc("get_user_integration", {
    _user_id: userId,
    _integration_key: integrationKey,
    _encryption_key: encryptionKey,
  });
  if (error) throw new Error(`Unable to read ${integrationKey} credential`);
  return typeof data === "string" ? data : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseStoredOAuth(integrationKey: string, stored: string): StoredOAuth | null {
  if (!stored) return null;
  if (!stored.startsWith("{")) {
    return {
      integrationKey,
      provider: INTEGRATION_TO_PROVIDER[integrationKey] ?? integrationKey,
      accessToken: stored,
      refreshToken: null,
      expiresAt: null,
      instanceUrl: null,
      apiDomain: null,
      locationId: null,
      accountLabel: null,
      raw: { access_token: stored },
    };
  }
  try {
    const raw = asRecord(JSON.parse(stored));
    const accessToken = String(raw.access_token ?? raw.accessToken ?? "");
    if (!accessToken) return null;
    return {
      integrationKey,
      provider: String(raw.provider ?? INTEGRATION_TO_PROVIDER[integrationKey] ?? integrationKey),
      accessToken,
      refreshToken: raw.refresh_token ? String(raw.refresh_token) : raw.refreshToken
        ? String(raw.refreshToken)
        : null,
      expiresAt: raw.expires_at ? String(raw.expires_at) : null,
      instanceUrl: raw.instance_url ? String(raw.instance_url) : null,
      apiDomain: raw.api_domain ? String(raw.api_domain) : raw.api_endpoint
        ? String(raw.api_endpoint)
        : null,
      locationId: raw.location_id ? String(raw.location_id) : raw.locationId
        ? String(raw.locationId)
        : null,
      accountLabel: raw.account_label ? String(raw.account_label) : null,
      raw,
    };
  } catch {
    return null;
  }
}

function tokenNeedsRefresh(oauth: StoredOAuth) {
  if (!oauth.refreshToken || !oauth.expiresAt) return false;
  const expiresAt = new Date(oauth.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now() + 60_000;
}

async function persistOAuth(
  admin: SupabaseClient,
  userId: string,
  oauth: StoredOAuth,
  encryptionKey: string,
) {
  const nextPayload = JSON.stringify({
    ...oauth.raw,
    provider: oauth.provider,
    access_token: oauth.accessToken,
    refresh_token: oauth.refreshToken,
    expires_at: oauth.expiresAt,
    instance_url: oauth.instanceUrl,
    api_domain: oauth.apiDomain,
    location_id: oauth.locationId,
  });
  const { error } = await admin.rpc("set_oauth_integration", {
    _user_id: userId,
    _integration_key: oauth.integrationKey,
    _token_payload: nextPayload,
    _account_label: oauth.accountLabel ?? `${oauth.provider} account`,
    _external_account_id: String(oauth.raw.external_account_id ?? oauth.locationId ?? ""),
    _scopes: Array.isArray(oauth.raw.scope) ? oauth.raw.scope : [],
    _token_expires_at: oauth.expiresAt,
    _encryption_key: encryptionKey,
  });
  if (error) throw new Error(`Unable to refresh ${oauth.integrationKey} credentials`);
}

async function refreshOAuth(oauth: StoredOAuth): Promise<StoredOAuth> {
  const providerKey = INTEGRATION_TO_PROVIDER[oauth.integrationKey];
  const provider = providerKey ? OAUTH_PROVIDERS[providerKey] : null;
  if (!provider || !oauth.refreshToken) {
    throw new Error(`Reconnect ${oauth.integrationKey} to renew access.`);
  }
  const { clientId, clientSecret } = clientCredentials(provider);
  if (!clientId || !clientSecret) {
    throw new Error(`${oauth.integrationKey} is not configured for token refresh.`);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams();

  if (provider.tokenFieldStyle === "gohighlevel") {
    headers.Version = "v3";
    body.set("clientId", clientId);
    body.set("clientSecret", clientSecret);
    body.set("grantType", "refresh_token");
    body.set("refreshToken", oauth.refreshToken);
    body.set("userType", "Location");
  } else if (provider.tokenFieldStyle === "stripe") {
    body.set("grant_type", "refresh_token");
    body.set("client_secret", clientSecret);
    body.set("refresh_token", oauth.refreshToken);
  } else {
    if (provider.tokenAuth === "basic") {
      headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    } else {
      body.set("client_id", clientId);
      body.set("client_secret", clientSecret);
    }
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", oauth.refreshToken);
  }

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  const payload = asRecord(await response.json().catch(() => ({})));
  const accessToken = String(
    payload.access_token ?? payload.accessToken ?? "",
  );
  if (!response.ok || !accessToken) {
    throw new Error(`${oauth.integrationKey} access expired. Reconnect the account.`);
  }
  const expiresIn = Number(payload.expires_in ?? payload.expiresIn ?? 0);
  return {
    ...oauth,
    accessToken,
    refreshToken: payload.refresh_token
      ? String(payload.refresh_token)
      : payload.refreshToken
        ? String(payload.refreshToken)
        : oauth.refreshToken,
    expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : oauth.expiresAt,
    instanceUrl: payload.instance_url ? String(payload.instance_url) : oauth.instanceUrl,
    apiDomain: payload.api_domain ? String(payload.api_domain) : oauth.apiDomain,
    locationId: payload.locationId ? String(payload.locationId) : oauth.locationId,
    raw: { ...oauth.raw, ...payload, access_token: accessToken },
  };
}

export async function loadConnectedOAuth(
  admin: SupabaseClient,
  userId: string,
  integrationKey: string,
  encryptionKey: string,
): Promise<StoredOAuth> {
  const stored = await readIntegrationSecret(admin, userId, integrationKey, encryptionKey);
  let oauth = parseStoredOAuth(integrationKey, stored);
  if (!oauth?.accessToken) {
    throw new Error(`Connect your ${integrationKey} account first`);
  }
  if (integrationKey === "gohighlevel" && !oauth.locationId) {
    const locationId = await readIntegrationSecret(
      admin,
      userId,
      "gohighlevel_location",
      encryptionKey,
    );
    oauth = { ...oauth, locationId: locationId || null };
  }
  if (tokenNeedsRefresh(oauth)) {
    oauth = await refreshOAuth(oauth);
    await persistOAuth(admin, userId, oauth, encryptionKey);
  }
  return oauth;
}
