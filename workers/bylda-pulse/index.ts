// bylda-pulse
// Cron: daily 8 AM UTC — build briefing per org and POST to Slack
// HTTP:  POST /pulse/trigger  (manual, Bearer-auth)
//        GET  /pulse/logs     (last 10 runs)

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_WEBHOOK_URL: string;
  CONTEXT_API_URL: string;
}

// ---------------------------------------------------------------------------
// Supabase REST helper (service role — bypasses RLS)
// ---------------------------------------------------------------------------

function sbH(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function sbGet<T>(url: string, env: Env): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: sbH(env) });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function sbInsert(table: string, body: Record<string, unknown>, env: Env): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbH(env), Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function sbUpsert(
  table: string,
  onConflict: string,
  body: Record<string, unknown>,
  env: Env,
): Promise<void> {
  await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { ...sbH(env), Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Severity rank for sorting (critical = 4 > high = 3 > medium = 2 > low = 1)
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function topBySeverity<T extends { severity: string }>(items: T[]): T | undefined {
  return [...items].sort(
    (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
  )[0];
}

// ---------------------------------------------------------------------------
// Core pulse logic
// ---------------------------------------------------------------------------

async function runPulse(env: Env): Promise<void> {
  // 1. Distinct orgs with open deviation alerts
  const alertRows = await sbGet<Array<{ org_id: string }>>(
    `${env.SUPABASE_URL}/rest/v1/deviation_alerts?status=eq.open&select=org_id`,
    env,
  );
  if (!alertRows) return;

  const orgIds = [...new Set(alertRows.map((r) => r.org_id))];
  let alertsSent = 0;
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 864e5).toISOString();

  for (const orgId of orgIds) {
    // 2a. Memory snapshot
    const [openAlerts, openLoops, pendingOutcomes] = await Promise.all([
      sbGet<Array<{ id: string; severity: string; title: string; diagnosis: string | null }>>(
        `${env.SUPABASE_URL}/rest/v1/deviation_alerts?org_id=eq.${orgId}&status=eq.open`,
        env,
      ),
      sbGet<Array<{ priority: string; title: string }>>(
        `${env.SUPABASE_URL}/rest/v1/open_loops?org_id=eq.${orgId}&status=in.(open,in_progress)`,
        env,
      ),
      sbGet<unknown[]>(
        `${env.SUPABASE_URL}/rest/v1/outcomes?org_id=eq.${orgId}&status=eq.pending&due_date=lte.${sevenDays}`,
        env,
      ),
    ]);

    const criticalLoops = (openLoops ?? []).filter((l) => l.priority === "critical");
    const topAlert = topBySeverity(openAlerts ?? []);
    const overdueCount = pendingOutcomes?.length ?? 0;
    const alertCount = openAlerts?.length ?? 0;

    // 2b. Recommended action
    let recommendedAction = "Review your Bylda dashboard for pending items.";
    if (topAlert?.severity === "critical") {
      recommendedAction = "Address critical metric deviation immediately.";
    } else if (topAlert?.severity === "high") {
      recommendedAction = "Resolve high-severity deviation alert today.";
    } else if (overdueCount > 0) {
      recommendedAction = "Log observed metrics for overdue expected outcomes.";
    } else if (criticalLoops.length > 0) {
      recommendedAction = "Resolve critical open loops before they compound.";
    }

    // 2c. Slack message
    const date = now.toISOString().split("T")[0];
    const lines: string[] = [
      `*Bylda Daily Pulse — ${date}*`,
      `Org: ${orgId}`,
      ``,
      `Open Alerts: ${alertCount}`,
      `Critical Open Loops: ${criticalLoops.length}`,
      `Pending Outcomes Due ≤7 days: ${overdueCount}`,
    ];

    if (topAlert) {
      lines.push(
        ``,
        `Top Alert [${topAlert.severity.toUpperCase()}]: ${topAlert.title}`,
        topAlert.diagnosis ?? "",
      );
    }

    lines.push(``, `Recommended: ${recommendedAction}`);

    await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.filter((l) => l !== undefined).join("\n") }),
    }).catch(() => {});

    // Persist the briefing so the app can show it (org_briefings, one per day).
    await sbUpsert(
      "org_briefings",
      "org_id,briefing_date",
      {
        org_id: orgId,
        briefing_date: date,
        alert_count: alertCount,
        critical_loop_count: criticalLoops.length,
        overdue_outcome_count: overdueCount,
        top_alert: topAlert
          ? { severity: topAlert.severity, title: topAlert.title, diagnosis: topAlert.diagnosis }
          : null,
        recommended_action: recommendedAction,
      },
      env,
    ).catch(() => {});

    alertsSent++;
  }

  // 3. Log the run
  await sbInsert(
    "pulse_logs",
    {
      org_count: orgIds.length,
      alerts_sent: alertsSent,
      metadata: { triggered_by: "cron" },
    },
    env,
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default {
  // Cron trigger
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runPulse(env));
  },

  // HTTP handler
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // POST /pulse/trigger — manual run, requires Bearer auth
    if (path === "/pulse/trigger" && method === "POST") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      ctx.waitUntil(runPulse(env));
      return new Response(JSON.stringify({ status: "triggered" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /pulse/logs — last 10 pulse runs
    if (path === "/pulse/logs" && method === "GET") {
      const data = await sbGet<unknown[]>(
        `${env.SUPABASE_URL}/rest/v1/pulse_logs?order=ran_at.desc&limit=10`,
        env,
      );
      return new Response(JSON.stringify(data ?? []), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
