export type OAuthProviderKey =
  | "hubspot"
  | "gohighlevel"
  | "google"
  | "microsoft"
  | "slack"
  | "salesforce"
  | "stripe"
  | "mailchimp"
  | "github"
  | "jira"
  | "asana"
  | "airtable"
  | "pipedrive"
  | "close"
  | "notion"
  | "zoom"
  | "calendly"
  | "xero";

export type OAuthProvider = {
  key: OAuthProviderKey;
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  tokenAuth?: "body" | "basic" | "basic_url";
  tokenBody?: "form" | "json";
  tokenFieldStyle?: "snake" | "gohighlevel" | "stripe" | "airtable";
  authorizeExtras?: Record<string, string>;
};

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export const OAUTH_PROVIDERS: Record<OAuthProviderKey, OAuthProvider> = {
  hubspot: {
    key: "hubspot",
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
    authorizeUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v3/token",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.contacts.write",
      "crm.objects.deals.read",
      "crm.objects.deals.write",
      "crm.objects.companies.read",
    ],
  },
  gohighlevel: {
    key: "gohighlevel",
    clientIdEnv: "GHL_CLIENT_ID",
    clientSecretEnv: "GHL_CLIENT_SECRET",
    authorizeUrl: "https://marketplace.leadconnectorhq.com/oauth/chooselocation",
    tokenUrl: "https://services.leadconnectorhq.com/oauth/token",
    scopes: [
      "contacts.readonly",
      "contacts.write",
      "opportunities.readonly",
      "opportunities.write",
      "conversations.readonly",
      "conversations/message.readonly",
    ],
    tokenFieldStyle: "gohighlevel",
  },
  google: {
    key: "google",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: GOOGLE_SCOPES,
    authorizeExtras: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  microsoft: {
    key: "microsoft",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "profile", "offline_access", "Files.Read", "Calendars.Read"],
  },
  slack: {
    key: "slack",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "chat:write", "users:read"],
  },
  salesforce: {
    key: "salesforce",
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
    authorizeUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: ["api", "refresh_token"],
    authorizeExtras: { prompt: "login consent" },
  },
  stripe: {
    key: "stripe",
    clientIdEnv: "STRIPE_CONNECT_CLIENT_ID",
    clientSecretEnv: "STRIPE_CONNECT_SECRET_KEY",
    authorizeUrl: "https://connect.stripe.com/oauth/authorize",
    tokenUrl: "https://connect.stripe.com/oauth/token",
    scopes: ["read_write"],
    tokenFieldStyle: "stripe",
  },
  mailchimp: {
    key: "mailchimp",
    clientIdEnv: "MAILCHIMP_CLIENT_ID",
    clientSecretEnv: "MAILCHIMP_CLIENT_SECRET",
    authorizeUrl: "https://login.mailchimp.com/oauth2/authorize",
    tokenUrl: "https://login.mailchimp.com/oauth2/token",
    scopes: [],
  },
  github: {
    key: "github",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "user:email"],
  },
  jira: {
    key: "jira",
    clientIdEnv: "JIRA_CLIENT_ID",
    clientSecretEnv: "JIRA_CLIENT_SECRET",
    authorizeUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: ["read:jira-work", "read:jira-user", "offline_access"],
    tokenBody: "json",
    authorizeExtras: { audience: "api.atlassian.com", prompt: "consent" },
  },
  asana: {
    key: "asana",
    clientIdEnv: "ASANA_CLIENT_ID",
    clientSecretEnv: "ASANA_CLIENT_SECRET",
    authorizeUrl: "https://app.asana.com/-/oauth_authorize",
    tokenUrl: "https://app.asana.com/-/oauth_token",
    scopes: ["users:read", "tasks:read", "projects:read", "workspaces:read"],
  },
  airtable: {
    key: "airtable",
    clientIdEnv: "AIRTABLE_CLIENT_ID",
    clientSecretEnv: "AIRTABLE_CLIENT_SECRET",
    authorizeUrl: "https://airtable.com/oauth2/v1/authorize",
    tokenUrl: "https://airtable.com/oauth2/v1/token",
    scopes: ["data.records:read", "schema.bases:read", "user.email:read"],
    tokenAuth: "basic_url",
    tokenFieldStyle: "airtable",
  },
  pipedrive: {
    key: "pipedrive",
    clientIdEnv: "PIPEDRIVE_CLIENT_ID",
    clientSecretEnv: "PIPEDRIVE_CLIENT_SECRET",
    authorizeUrl: "https://oauth.pipedrive.com/oauth/authorize",
    tokenUrl: "https://oauth.pipedrive.com/oauth/token",
    scopes: [],
    tokenAuth: "basic",
  },
  close: {
    key: "close",
    clientIdEnv: "CLOSE_CLIENT_ID",
    clientSecretEnv: "CLOSE_CLIENT_SECRET",
    authorizeUrl: "https://app.close.com/oauth2/authorize/",
    tokenUrl: "https://api.close.com/oauth2/token/",
    scopes: [],
  },
  notion: {
    key: "notion",
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    tokenAuth: "basic",
    tokenBody: "json",
    authorizeExtras: { owner: "user" },
  },
  zoom: {
    key: "zoom",
    clientIdEnv: "ZOOM_CLIENT_ID",
    clientSecretEnv: "ZOOM_CLIENT_SECRET",
    authorizeUrl: "https://zoom.us/oauth/authorize",
    tokenUrl: "https://zoom.us/oauth/token",
    scopes: [],
    tokenAuth: "basic",
  },
  calendly: {
    key: "calendly",
    clientIdEnv: "CALENDLY_CLIENT_ID",
    clientSecretEnv: "CALENDLY_CLIENT_SECRET",
    authorizeUrl: "https://auth.calendly.com/oauth/authorize",
    tokenUrl: "https://auth.calendly.com/oauth/token",
    scopes: [],
  },
  xero: {
    key: "xero",
    clientIdEnv: "XERO_CLIENT_ID",
    clientSecretEnv: "XERO_CLIENT_SECRET",
    authorizeUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "accounting.transactions",
      "accounting.contacts",
    ],
    tokenAuth: "basic",
  },
};

export const INTEGRATION_PROVIDER: Record<string, OAuthProviderKey> = {
  hubspot: "hubspot",
  gohighlevel: "gohighlevel",
  salesforce: "salesforce",
  stripe: "stripe",
  mailchimp: "mailchimp",
  github: "github",
  jira: "jira",
  asana: "asana",
  airtable: "airtable",
  pipedrive: "pipedrive",
  close_io: "close",
  slack: "slack",
  googlesheets: "google",
  googledrive: "google",
  google_calendar: "google",
  youtube_api: "google",
  googleanalytics: "google",
  onedrive: "microsoft",
  outlook_cal: "microsoft",
  notion: "notion",
  zoom: "zoom",
  calendly: "calendly",
  xero: "xero",
};

export const CALLBACK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/integration-oauth-callback`;

export function scopesForIntegration(integrationKey: string, provider: OAuthProvider) {
  const scoped: Record<string, string[]> = {
    googlesheets: ["openid", "email", "https://www.googleapis.com/auth/spreadsheets.readonly"],
    googledrive: ["openid", "email", "https://www.googleapis.com/auth/drive.readonly"],
    google_calendar: ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"],
    youtube_api: ["openid", "email", "https://www.googleapis.com/auth/youtube.readonly"],
    onedrive: ["openid", "email", "profile", "offline_access", "Files.Read"],
    outlook_cal: ["openid", "email", "profile", "offline_access", "Calendars.Read"],
    googleanalytics: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/analytics.readonly",
    ],
  };
  return scoped[integrationKey] ?? provider.scopes;
}

export function clientCredentials(provider: OAuthProvider) {
  return {
    clientId: Deno.env.get(provider.clientIdEnv) ?? "",
    clientSecret: Deno.env.get(provider.clientSecretEnv) ?? "",
  };
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

export async function pkceVerifier(state: string, clientSecret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(state));
  return base64Url(new Uint8Array(signature));
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
