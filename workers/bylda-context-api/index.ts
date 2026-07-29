// bylda-context-api
// Phase 1 — /context/*  : ingest, sources, semantic search
// Phase 2 — /memory/*   : decisions, strategies, outcomes, open_loops, snapshot
// Phase 3 — /monitor/*  : expected outcomes, observed metrics, deviation alerts, report

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY: string;
}

const ALLOWED_ORIGINS = ["https://usebylda.com", "http://localhost:3000"];
const N8N_BASE = "https://launchpad-novaops.app.n8n.cloud/webhook";

// ---------------------------------------------------------------------------
// CORS / response helpers
// ---------------------------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function validateJWT(request: Request, env: Env): Promise<{ userId: string } | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string };
    return { userId: user.id };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

function sbH(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: "return=representation",
    ...extra,
  };
}

async function sbGet<T>(url: string, env: Env): Promise<T | null> {
  const res = await fetch(url, {
    headers: { ...sbH(env), Prefer: "" },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function sbInsert<T>(
  table: string,
  body: Record<string, unknown>,
  env: Env,
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbH(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    return { data: null, error: err.message ?? "Insert failed" };
  }
  const rows = (await res.json()) as T[];
  return { data: rows[0] ?? null, error: null };
}

async function sbPatch<T>(
  table: string,
  filter: string,
  body: Record<string, unknown>,
  env: Env,
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: sbH(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    return { data: null, error: err.message ?? "Update failed" };
  }
  const rows = (await res.json()) as T[];
  return { data: rows[0] ?? null, error: null };
}

async function sbRpc<T>(fn: string, body: Record<string, unknown>, env: Env): Promise<T | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...sbH(env), Prefer: "" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

async function embed(text: string, env: Env): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text, model: "text-embedding-3-small" }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return payload.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route matching helpers
// ---------------------------------------------------------------------------

function pathMatch(path: string, pattern: RegExp): RegExpMatchArray | null {
  return path.match(pattern);
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const { pathname: path, searchParams } = url;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ===================================================================
    // PHASE 1 — Context routes
    // ===================================================================

    // POST /context/ingest
    if (path === "/context/ingest" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        source_type: string;
        content?: string;
        source_url?: string;
        name: string;
      };

      const { data: source, error } = await sbInsert<{ id: string }>(
        "context_sources",
        {
          org_id: auth.userId,
          source_type: body.source_type,
          source_url: body.source_url ?? null,
          name: body.name,
        },
        env,
      );

      if (error || !source) return json({ error: error ?? "Insert failed" }, 400, origin);

      // fire-and-forget to n8n
      fetch(`${N8N_BASE}/context-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: auth.userId,
          source_type: body.source_type,
          content: body.content,
          source_url: body.source_url,
          name: body.name,
          source_id: source.id,
        }),
      }).catch(() => {});

      return json({ status: "queued", source_id: source.id }, 200, origin);
    }

    // GET /context/sources
    if (path === "/context/sources" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const data = await sbGet<unknown[]>(
        `${env.SUPABASE_URL}/rest/v1/context_sources?org_id=eq.${auth.userId}&order=created_at.desc`,
        env,
      );
      return json(data ?? [], 200, origin);
    }

    // DELETE /context/sources/:id
    const deleteSourceM = pathMatch(path, /^\/context\/sources\/([^/]+)$/);
    if (deleteSourceM && method === "DELETE") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const { error } = await sbPatch(
        "context_sources",
        `id=eq.${deleteSourceM[1]}&org_id=eq.${auth.userId}`,
        { status: "inactive" },
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json({ status: "inactive" }, 200, origin);
    }

    // GET /context/search?q=
    if (path === "/context/search" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const q = searchParams.get("q");
      if (!q) return json({ error: "Missing ?q" }, 400, origin);

      const embedding = await embed(q, env);
      if (!embedding) return json({ error: "Embedding failed" }, 502, origin);

      const results = await sbRpc<unknown[]>(
        "match_documents",
        { query_embedding: embedding, match_count: 10, filter_org_id: auth.userId },
        env,
      );
      return json(results ?? [], 200, origin);
    }

    // ===================================================================
    // PHASE 2 — Memory routes
    // ===================================================================

    // POST /memory/decision
    if (path === "/memory/decision" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        title: string;
        description?: string;
        rationale?: string;
        session_id?: string;
        status?: string;
      };

      const { data, error } = await sbInsert(
        "decisions",
        {
          org_id: auth.userId,
          title: body.title,
          description: body.description ?? null,
          rationale: body.rationale ?? null,
          session_id: body.session_id ?? null,
          status: body.status ?? "open",
        },
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json(data, 200, origin);
    }

    // GET /memory/decisions
    if (path === "/memory/decisions" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const data = await sbGet<unknown[]>(
        `${env.SUPABASE_URL}/rest/v1/decisions?org_id=eq.${auth.userId}&order=created_at.desc&limit=50`,
        env,
      );
      return json(data ?? [], 200, origin);
    }

    // POST /memory/strategy
    if (path === "/memory/strategy" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        title: string;
        objective?: string;
        steps?: unknown[];
        triggers?: unknown[];
        success_metrics?: unknown[];
        spec_type?: string;
        executable?: boolean;
      };

      const { data, error } = await sbInsert(
        "strategies",
        {
          org_id: auth.userId,
          title: body.title,
          objective: body.objective ?? null,
          steps: body.steps ?? [],
          triggers: body.triggers ?? [],
          success_metrics: body.success_metrics ?? [],
          spec_type: body.spec_type ?? null,
          executable: body.executable ?? false,
        },
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json(data, 200, origin);
    }

    // GET /memory/strategies
    if (path === "/memory/strategies" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      let qs = `org_id=eq.${auth.userId}&order=created_at.desc`;
      if (searchParams.get("executable") === "true") qs += "&executable=eq.true";

      const data = await sbGet<unknown[]>(`${env.SUPABASE_URL}/rest/v1/strategies?${qs}`, env);
      return json(data ?? [], 200, origin);
    }

    // POST /memory/outcome
    if (path === "/memory/outcome" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        description: string;
        expected_value?: string;
        due_date?: string;
        strategy_id?: string;
        decision_id?: string;
      };

      const { data, error } = await sbInsert(
        "outcomes",
        {
          org_id: auth.userId,
          description: body.description,
          expected_value: body.expected_value ?? null,
          due_date: body.due_date ?? null,
          strategy_id: body.strategy_id ?? null,
          decision_id: body.decision_id ?? null,
        },
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json(data, 200, origin);
    }

    // POST /memory/open_loop
    if (path === "/memory/open_loop" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        title: string;
        description?: string;
        priority?: string;
        linked_decision_id?: string;
        linked_strategy_id?: string;
      };

      const { data, error } = await sbInsert(
        "open_loops",
        {
          org_id: auth.userId,
          title: body.title,
          description: body.description ?? null,
          priority: body.priority ?? "medium",
          linked_decision_id: body.linked_decision_id ?? null,
          linked_strategy_id: body.linked_strategy_id ?? null,
        },
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json(data, 200, origin);
    }

    // GET /memory/open_loops
    if (path === "/memory/open_loops" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      let qs = `org_id=eq.${auth.userId}&order=priority.desc,created_at.desc`;
      const statusF = searchParams.get("status");
      if (statusF) qs += `&status=eq.${statusF}`;

      const data = await sbGet<unknown[]>(`${env.SUPABASE_URL}/rest/v1/open_loops?${qs}`, env);
      return json(data ?? [], 200, origin);
    }

    // GET /memory/snapshot  — session context injection payload
    if (path === "/memory/snapshot" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const uid = auth.userId;
      const sevenDays = new Date(Date.now() + 7 * 864e5).toISOString();

      const [recentDecisions, activeStrategies, openLoops, pendingOutcomes] = await Promise.all([
        sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/decisions?org_id=eq.${uid}&order=created_at.desc&limit=5`,
          env,
        ),
        sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/strategies?org_id=eq.${uid}&status=eq.active`,
          env,
        ),
        sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/open_loops?org_id=eq.${uid}&status=in.(open,in_progress)`,
          env,
        ),
        sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/outcomes?org_id=eq.${uid}&status=eq.pending&due_date=lte.${sevenDays}`,
          env,
        ),
      ]);

      return json(
        {
          recent_decisions: recentDecisions ?? [],
          active_strategies: activeStrategies ?? [],
          open_loops: openLoops ?? [],
          pending_outcomes: pendingOutcomes ?? [],
        },
        200,
        origin,
      );
    }

    // ===================================================================
    // PHASE 3 — Monitor routes
    // ===================================================================

    // POST /monitor/expected
    if (path === "/monitor/expected" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        metric_name: string;
        target_value: number;
        target_unit?: string;
        check_date: string;
        tolerance_pct?: number;
        strategy_id?: string;
      };

      const { data, error } = await sbInsert(
        "expected_outcomes",
        {
          org_id: auth.userId,
          metric_name: body.metric_name,
          target_value: body.target_value,
          target_unit: body.target_unit ?? null,
          check_date: body.check_date,
          tolerance_pct: body.tolerance_pct ?? 20,
          strategy_id: body.strategy_id ?? null,
        },
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json(data, 200, origin);
    }

    // POST /monitor/observed
    if (path === "/monitor/observed" && method === "POST") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as {
        metric_name: string;
        observed_value: number;
        source?: string;
        expected_outcome_id?: string;
      };

      const { data: observed, error: obsErr } = await sbInsert<{ id: string }>(
        "observed_metrics",
        {
          org_id: auth.userId,
          metric_name: body.metric_name,
          observed_value: body.observed_value,
          source: body.source ?? null,
          expected_outcome_id: body.expected_outcome_id ?? null,
        },
        env,
      );
      if (obsErr || !observed) return json({ error: obsErr ?? "Insert failed" }, 400, origin);

      let deviationPct: number | undefined;
      let alertCreated = false;
      let alertId: string | undefined;

      if (body.expected_outcome_id) {
        const rows = await sbGet<
          Array<{ target_value: number; tolerance_pct: number; metric_name: string }>
        >(
          `${env.SUPABASE_URL}/rest/v1/expected_outcomes?id=eq.${body.expected_outcome_id}&org_id=eq.${auth.userId}`,
          env,
        );
        const expected = rows?.[0];

        if (expected) {
          deviationPct =
            (Math.abs(body.observed_value - expected.target_value) / expected.target_value) * 100;
          const tolerance = expected.tolerance_pct ?? 20;

          if (deviationPct > tolerance) {
            let severity: string;
            if (deviationPct > 80) severity = "critical";
            else if (deviationPct > 60) severity = "high";
            else if (deviationPct > 40) severity = "medium";
            else severity = "low";

            const { data: alert } = await sbInsert<{ id: string }>(
              "deviation_alerts",
              {
                org_id: auth.userId,
                expected_outcome_id: body.expected_outcome_id,
                alert_type: "metric_deviation",
                severity,
                title: `Deviation on ${body.metric_name}`,
                diagnosis: `Observed ${body.observed_value} vs target ${expected.target_value} — ${deviationPct.toFixed(1)}% deviation (tolerance ${tolerance}%)`,
              },
              env,
            );
            if (alert) {
              alertCreated = true;
              alertId = alert.id;
            }
          }
        }
      }

      return json(
        { deviation_pct: deviationPct, alert_created: alertCreated, alert_id: alertId },
        200,
        origin,
      );
    }

    // GET /monitor/alerts
    if (path === "/monitor/alerts" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      let qs = `org_id=eq.${auth.userId}&order=triggered_at.desc`;
      const statusF = searchParams.get("status");
      const severityF = searchParams.get("severity");
      if (statusF) qs += `&status=eq.${statusF}`;
      if (severityF) qs += `&severity=eq.${severityF}`;

      const data = await sbGet<unknown[]>(
        `${env.SUPABASE_URL}/rest/v1/deviation_alerts?${qs}`,
        env,
      );
      return json(data ?? [], 200, origin);
    }

    // PATCH /monitor/alerts/:id
    const patchAlertM = pathMatch(path, /^\/monitor\/alerts\/([^/]+)$/);
    if (patchAlertM && method === "PATCH") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const body = (await request.json()) as { status: string };
      const update: Record<string, unknown> = { status: body.status };
      if (body.status === "resolved") update.resolved_at = new Date().toISOString();

      const { data, error } = await sbPatch(
        "deviation_alerts",
        `id=eq.${patchAlertM[1]}&org_id=eq.${auth.userId}`,
        update,
        env,
      );
      if (error) return json({ error }, 400, origin);
      return json(data, 200, origin);
    }

    // GET /monitor/deviation-report
    if (path === "/monitor/deviation-report" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const uid = auth.userId;
      const now = new Date().toISOString();

      const [openAlerts, recentAlerts, overdueExpected, allOutcomes] = await Promise.all([
        sbGet<Array<{ severity: string }>>(
          `${env.SUPABASE_URL}/rest/v1/deviation_alerts?org_id=eq.${uid}&status=eq.open&select=severity`,
          env,
        ),
        sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/deviation_alerts?org_id=eq.${uid}&order=triggered_at.desc&limit=10`,
          env,
        ),
        sbGet<Array<{ id: string }>>(
          `${env.SUPABASE_URL}/rest/v1/expected_outcomes?org_id=eq.${uid}&check_date=lt.${now}`,
          env,
        ),
        sbGet<Array<{ strategy_id: string | null; status: string }>>(
          `${env.SUPABASE_URL}/rest/v1/outcomes?org_id=eq.${uid}&select=strategy_id,status`,
          env,
        ),
      ]);

      // Open alerts count by severity
      const alertCounts: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
      (openAlerts ?? []).forEach((a) => {
        if (a.severity in alertCounts) alertCounts[a.severity]++;
      });

      // Overdue expected_outcomes with no observed metrics
      const overdueWithNoObs: unknown[] = [];
      for (const eo of overdueExpected ?? []) {
        const obs = await sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/observed_metrics?expected_outcome_id=eq.${eo.id}&limit=1`,
          env,
        );
        if (!obs || obs.length === 0) overdueWithNoObs.push(eo);
      }

      // Misaligned strategies (missed > met)
      const stratMap: Record<string, { met: number; missed: number }> = {};
      (allOutcomes ?? []).forEach((o) => {
        if (!o.strategy_id) return;
        stratMap[o.strategy_id] ??= { met: 0, missed: 0 };
        if (o.status === "met") stratMap[o.strategy_id].met++;
        if (o.status === "missed") stratMap[o.strategy_id].missed++;
      });

      const misalignedIds = Object.entries(stratMap)
        .filter(([, v]) => v.missed > v.met)
        .map(([k]) => k);

      let misalignedStrategies: unknown[] = [];
      if (misalignedIds.length > 0) {
        const strats = await sbGet<unknown[]>(
          `${env.SUPABASE_URL}/rest/v1/strategies?id=in.(${misalignedIds.join(",")})`,
          env,
        );
        misalignedStrategies = strats ?? [];
      }

      return json(
        {
          open_alerts: alertCounts,
          recent_alerts: recentAlerts ?? [],
          overdue_outcomes: overdueWithNoObs,
          misaligned_strategies: misalignedStrategies,
        },
        200,
        origin,
      );
    }

    // ===================================================================
    // PHASE 4 — Events
    // ===================================================================

    // GET /events/recent?limit=20&source=mission&type=step.completed
    if (path === "/events/recent" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const orgRow = await sbGet<{ organization_id: string }[]>(
        `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${auth.userId}&select=organization_id&limit=1`,
        env,
      );
      const orgId = orgRow?.[0]?.organization_id;
      if (!orgId) return json({ error: "No organization found for user" }, 404, origin);

      const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
      const source = searchParams.get("source");
      const eventType = searchParams.get("type");

      let qs = `organization_id=eq.${orgId}&order=created_at.desc&limit=${limit}`;
      if (source) qs += `&source=eq.${source}`;
      if (eventType) qs += `&event_type=eq.${eventType}`;

      const data = await sbGet<unknown[]>(`${env.SUPABASE_URL}/rest/v1/bylda_events?${qs}`, env);
      return json(data ?? [], 200, origin);
    }

    // GET /events/summary — counts per event_type in the last 7 days
    if (path === "/events/summary" && method === "GET") {
      const auth = await validateJWT(request, env);
      if (!auth) return json({ error: "Unauthorized" }, 401, origin);

      const orgRow = await sbGet<{ organization_id: string }[]>(
        `${env.SUPABASE_URL}/rest/v1/organization_members?user_id=eq.${auth.userId}&select=organization_id&limit=1`,
        env,
      );
      const orgId = orgRow?.[0]?.organization_id;
      if (!orgId) return json({ error: "No organization found for user" }, 404, origin);

      const sevenDays = new Date(Date.now() - 7 * 86400000).toISOString();
      const data = await sbGet<{ event_type: string }[]>(
        `${env.SUPABASE_URL}/rest/v1/bylda_events?organization_id=eq.${orgId}&created_at=gte.${sevenDays}&select=event_type`,
        env,
      );

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
      }

      return json({ window_days: 7, counts }, 200, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};
