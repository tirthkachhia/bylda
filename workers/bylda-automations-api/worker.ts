// bylda-automations-api
// POST /api/automations/trigger — enqueue automation job
// GET  /api/automations/configs  — list user's automation configs
// POST /api/automations/configs  — upsert automation config

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AUTOMATION_QUEUE: Queue<AutomationJob>;
}

interface AutomationJob {
  automation_slug: string;
  payload: Record<string, unknown>;
  user_id: string;
  triggered_at: string;
  log_id?: string;
}

const ALLOWED_ORIGIN = "https://app.usebylda.com";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function validateJWT(token: string, env: Env): Promise<{ sub: string } | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string };
    return { sub: user.id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Plan gate — check automations_allowed
// ---------------------------------------------------------------------------
async function getUserPlan(userId: string, env: Env): Promise<string> {
  const orgRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!orgRes.ok) return "starter";
  const orgs = (await orgRes.json()) as Array<{ organization_id: string }>;
  if (!orgs.length) return "starter";

  const orgIds = orgs.map((o) => o.organization_id).join(",");
  const subRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscriptions?organization_id=in.(${orgIds})&select=plan_tier&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!subRes.ok) return "starter";
  const subs = (await subRes.json()) as Array<{ plan_tier: string }>;
  return subs[0]?.plan_tier ?? "starter";
}

async function isAutomationEntitled(
  automationSlug: string,
  planTier: string,
  env: Env,
): Promise<boolean> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/plan_entitlements_data?plan_tier=eq.${planTier}&select=automations_allowed`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) return false;
  const rows = await rows_json<{ automations_allowed: string[] }>(res);
  if (!rows.length) return false;
  return rows[0].automations_allowed?.includes(automationSlug) ?? false;
}

// Helper to parse JSON from response
async function rows_json<T>(res: Response): Promise<T[]> {
  try {
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
function sbHeaders(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleTrigger(request: Request, env: Env, origin: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const user = await validateJWT(token, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as {
    automation_slug: string;
    payload: Record<string, unknown>;
  };
  const { automation_slug, payload } = body;

  if (!automation_slug) {
    return new Response(JSON.stringify({ error: "automation_slug is required" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  // Plan gate
  const planTier = await getUserPlan(user.sub, env);
  const entitled = await isAutomationEntitled(automation_slug, planTier, env);
  if (!entitled) {
    return new Response(JSON.stringify({ error: "upgrade_required", upgrade_to: "launch" }), {
      status: 403,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  // Insert log record with status='queued'
  const logInsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/automation_logs`, {
    method: "POST",
    headers: {
      ...sbHeaders(env),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: user.sub,
      automation_slug,
      payload,
      status: "queued",
      triggered_at: new Date().toISOString(),
    }),
  });

  let logId: string | undefined;
  if (logInsertRes.ok) {
    const logs = (await logInsertRes.json()) as Array<{ id: string }>;
    logId = logs[0]?.id;
  }

  // Enqueue to Cloudflare Queue
  const job: AutomationJob = {
    automation_slug,
    payload,
    user_id: user.sub,
    triggered_at: new Date().toISOString(),
    log_id: logId,
  };

  try {
    await env.AUTOMATION_QUEUE.send(job);
  } catch (queueErr) {
    // If queue fails, update log status to 'failed' and return error
    if (logId) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/automation_logs?id=eq.${logId}`, {
        method: "PATCH",
        headers: {
          ...sbHeaders(env),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "failed",
          error_message: `Queue enqueue failed: ${queueErr instanceof Error ? queueErr.message : "Unknown error"}`,
          completed_at: new Date().toISOString(),
        }),
      });
    }
    return new Response(
      JSON.stringify({
        error: "Failed to queue automation",
        message: queueErr instanceof Error ? queueErr.message : "Unknown error",
        log_id: logId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ success: true, log_id: logId }), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function handleGetConfigs(request: Request, env: Env, origin: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const user = await validateJWT(token, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/automation_configs?user_id=eq.${user.sub}&order=created_at.desc`,
    { headers: sbHeaders(env) },
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Failed to fetch configs" }), {
      status: 502,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const configs = await res.json();
  return new Response(JSON.stringify(configs), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function handleUpsertConfig(request: Request, env: Env, origin: string): Promise<Response> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const user = await validateJWT(token, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as Record<string, unknown>;

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/automation_configs`, {
    method: "POST",
    headers: {
      ...sbHeaders(env),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      ...body,
      user_id: user.sub,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: "Failed to upsert config", detail: err }), {
      status: 502,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const config = await res.json();
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // POST /api/automations/trigger
    if (request.method === "POST" && path === "/api/automations/trigger") {
      return handleTrigger(request, env, origin);
    }

    // GET /api/automations/configs
    if (request.method === "GET" && path === "/api/automations/configs") {
      return handleGetConfigs(request, env, origin);
    }

    // POST /api/automations/configs
    if (request.method === "POST" && path === "/api/automations/configs") {
      return handleUpsertConfig(request, env, origin);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  },
};
