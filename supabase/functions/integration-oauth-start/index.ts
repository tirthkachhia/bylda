import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CALLBACK_URL,
  INTEGRATION_PROVIDER,
  OAUTH_PROVIDERS,
  clientCredentials,
  pkceChallenge,
  pkceVerifier,
  randomState,
  scopesForIntegration,
  sha256,
} from "../_shared/integration-oauth.ts";

const allowedOrigins = new Set([
  Deno.env.get("APP_URL") ?? "https://app.usebylda.com",
  "https://bylda-eight.vercel.app",
  "http://localhost:3000",
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

  const body = await req.json().catch(() => null);
  const integrationKey = String(body?.integration_key ?? "");
  const providerKey = INTEGRATION_PROVIDER[integrationKey];
  if (!providerKey) {
    return json(
      req,
      {
        error: "This provider does not offer a Bylda managed sign-in yet.",
        code: "OAUTH_NOT_AVAILABLE",
      },
      400,
    );
  }

  const provider = OAUTH_PROVIDERS[providerKey];
  const { clientId, clientSecret } = clientCredentials(provider);
  if (!clientId || !clientSecret) {
    return json(
      req,
      {
        error: `${providerKey} sign-in is awaiting administrator configuration.`,
        code: "OAUTH_NOT_CONFIGURED",
      },
      503,
    );
  }

  const state = randomState();
  const requestedScopes = scopesForIntegration(integrationKey, provider);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error: stateError } = await admin.from("integration_oauth_states").insert({
    state_hash: await sha256(state),
    user_id: userData.user.id,
    provider: providerKey,
    integration_key: integrationKey,
    requested_scopes: requestedScopes,
    redirect_to: "/app/integrations",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateError) {
    console.error("[integration-oauth-start] state insert", stateError.message);
    return json(req, { error: "Could not start secure sign-in" }, 500);
  }

  const url = new URL(provider.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", CALLBACK_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (provider.key === "salesforce") {
    const verifier = await pkceVerifier(state, clientSecret);
    url.searchParams.set("code_challenge", await pkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  if (requestedScopes.length) {
    url.searchParams.set(
      "scope",
      provider.key === "slack" ? requestedScopes.join(",") : requestedScopes.join(" "),
    );
  }
  for (const [key, value] of Object.entries(provider.authorizeExtras ?? {})) {
    url.searchParams.set(key, value);
  }

  return json(req, { authorization_url: url.toString(), provider: providerKey });
});
