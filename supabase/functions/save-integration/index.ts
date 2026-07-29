// Securely upsert a user_integrations row. The encryption key never leaves the server.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Accept any lowercase-alpha-start key with letters/digits/underscores/dashes (2-64 chars).
// This covers all catalog keys and user-defined custom integration keys.
const SAFE_KEY_RE = /^[a-z][a-z0-9_-]{1,63}$/;
// Bylda module webhooks keep their own prefix format.
const BYLDA_WEBHOOK_RE = /^bylda:webhook:[a-z0-9_-]{1,64}$/;

function isAllowedKey(k: string): boolean {
  return SAFE_KEY_RE.test(k) || BYLDA_WEBHOOK_RE.test(k);
}

// Per-key validation for well-known integrations with strict formats.
function validateValue(integrationKey: string, value: string): string | null {
  if (!value) return null; // clearing is always allowed

  switch (integrationKey) {
    case "stripe":
      if (!/^sk_(live|test)_[A-Za-z0-9]{20,}$/.test(value))
        return "Stripe key must start with sk_live_ or sk_test_";
      return null;

    case "airtable":
      if (!/^pat[A-Za-z0-9._]{10,}$/.test(value)) return "Airtable token must start with pat";
      return null;

    case "gohighlevel":
      if (value.length < 10) return "API key is too short";
      return null;

    // ── BYO provider sub-fields (multi-field credentials) ──
    case "sendgrid_from":
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
        return "Enter a valid sender email (e.g. you@yourdomain.com)";
      return null;

    case "twilio_sid":
      if (!/^AC[A-Za-z0-9]{10,}$/.test(value)) return "Twilio Account SID starts with AC…";
      return null;

    case "twilio_from":
      // Either an E.164 phone number (+15551234567) or a Messaging Service SID (MG…).
      if (!/^\+?[1-9]\d{6,15}$/.test(value) && !/^MG[A-Za-z0-9]{10,}$/.test(value))
        return "Enter an E.164 number (e.g. +15551234567) or a Messaging Service SID";
      return null;

    case "zapier": {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return "Must be a valid https:// URL";
      }
      if (url.protocol !== "https:") return "URL must use https://";
      if (!url.hostname.includes("zapier.com")) return "Must be a hooks.zapier.com URL";
      return null;
    }

    case "slack": {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return "Must be a valid https:// URL";
      }
      if (url.protocol !== "https:") return "URL must use https://";
      if (!url.hostname.includes("slack.com")) return "Must be a hooks.slack.com URL";
      return null;
    }

    case "discord":
    case "msteams":
    case "make":
    case "n8n":
    case "pipedream":
    case "workato": {
      // Require HTTPS URL for all webhook-type integrations
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return "Must be a valid https:// URL";
      }
      if (url.protocol !== "https:") return "URL must use https://";
      return null;
    }

    default:
      // All other integrations: accept any non-empty string value
      return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Fail closed: INTEGRATIONS_ENCRYPTION_KEY is REQUIRED. Falling back to the
    // service-role key (the old behavior) silently downgraded the encryption
    // model — a leaked service key would also decrypt every stored credential.
    const encKey = Deno.env.get("INTEGRATIONS_ENCRYPTION_KEY");
    if (!encKey || encKey.length < 16) {
      console.error(
        "[save-integration] INTEGRATIONS_ENCRYPTION_KEY missing/too short — refusing to store credentials",
      );
      return json(
        {
          error: "Integration storage is not configured. Contact support.",
          code: "ENC_KEY_MISSING",
        },
        503,
      );
    }

    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth! } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);

    const integrationKey = String(body.integration_key || "").trim();
    const value = body.value == null ? "" : String(body.value);

    if (!isAllowedKey(integrationKey)) {
      return json(
        {
          error:
            "Invalid integration_key — must be lowercase letters, digits, underscores, or dashes",
        },
        400,
      );
    }
    if (value.length > 4096) return json({ error: "Value too long" }, 400);

    const formatError = validateValue(integrationKey, value);
    if (formatError) return json({ error: formatError }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin.rpc("set_user_integration", {
      _user_id: userId,
      _integration_key: integrationKey,
      _value: value,
      _encryption_key: encKey,
    });

    if (error) {
      console.error("[save-integration] rpc error", error.message);
      return json({ error: "Failed to save integration" }, 500);
    }

    // Write a memory artifact so Bylda knows what integrations are active for this org.
    const { data: memberRow } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const orgId = memberRow?.organization_id as string | undefined;
    if (orgId) {
      const isConnecting = !!value;
      // Find existing artifact first to decide insert vs update.
      const { data: existing } = await admin
        .from("memory_artifacts")
        .select("id")
        .eq("org_id", orgId)
        .eq("source_type", "integration")
        .eq("source_label", integrationKey)
        .maybeSingle();

      const artifactPayload = {
        org_id: orgId,
        user_id: userId,
        source_type: "integration",
        source_label: integrationKey,
        title: `${integrationKey} integration ${isConnecting ? "connected" : "disconnected"}`,
        content_preview: isConnecting
          ? `The user has connected their ${integrationKey} account. Bylda can reference and use this integration when helping with related tasks.`
          : `The user has disconnected their ${integrationKey} account.`,
        status: isConnecting ? "indexed" : "disabled",
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: updErr } = await admin
          .from("memory_artifacts")
          .update(artifactPayload)
          .eq("id", (existing as { id: string }).id);
        if (updErr)
          console.warn("[save-integration] memory artifact update failed:", updErr.message);
      } else if (isConnecting) {
        const { error: insErr } = await admin
          .from("memory_artifacts")
          .insert({ ...artifactPayload, created_at: new Date().toISOString() });
        if (insErr)
          console.warn("[save-integration] memory artifact insert failed:", insErr.message);
      }
    }

    const row = Array.isArray(data) ? data[0] : data;
    return json({
      ok: true,
      integration: {
        integration_key: row?.integration_key ?? integrationKey,
        status: row?.status ?? (value ? "connected" : "disabled"),
        value_last4: row?.value_last4 ?? null,
        is_connected: row?.is_connected ?? !!value,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[save-integration] error", msg);
    return json({ error: "Internal error" }, 500);
  }
});
