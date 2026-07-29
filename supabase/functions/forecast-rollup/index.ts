// forecast-rollup — snapshots the org's current forecast by category into
// forecast_snapshots (for historical accuracy tracking) and writes a concise
// forecast verdict under Dhruv Patel (the numbers/forecast mentor). On-demand
// from RevOps, or nightly via cron (internal). Idempotent per day: it replaces
// the day's snapshot + verdict for the org so re-runs never double-count.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const AGENT_ID = "dhruv-patel";
const CATEGORIES = ["pipeline", "best_case", "commit", "closed", "omitted"] as const;

/** Current fiscal period label, e.g. "2026-Q3". */
function currentPeriod(d = new Date()): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

async function rollupOrg(admin: SupabaseClient, orgId: string): Promise<number> {
  const period = currentPeriod();

  const { data: deals } = await admin
    .from("deal_forecast")
    .select("forecast_category, value, weighted_value")
    .eq("organization_id", orgId)
    .limit(5000);

  const agg = new Map<string, { amount: number; weighted: number; count: number }>();
  for (const cat of CATEGORIES) agg.set(cat, { amount: 0, weighted: 0, count: 0 });
  for (const d of deals ?? []) {
    const cat = String(d.forecast_category);
    const row = agg.get(cat);
    if (!row) continue;
    row.amount += Number(d.value ?? 0);
    row.weighted += Number(d.weighted_value ?? 0);
    row.count += 1;
  }

  // Replace today's snapshot for this org/period (idempotent per day).
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  await admin
    .from("forecast_snapshots")
    .delete()
    .eq("organization_id", orgId)
    .eq("period", period)
    .is("user_id", null)
    .gte("captured_at", startOfDay.toISOString());

  const rows = CATEGORIES.map((cat) => {
    const r = agg.get(cat)!;
    return {
      organization_id: orgId,
      user_id: null,
      period,
      forecast_category: cat,
      amount: r.amount,
      weighted_amount: r.weighted,
      deal_count: r.count,
    };
  });
  await admin.from("forecast_snapshots").insert(rows);

  // ── Dhruv's forecast verdict ───────────────────────────────────────────────
  const commit = agg.get("commit")!;
  const bestCase = agg.get("best_case")!;
  const closed = agg.get("closed")!;

  const { data: quotaRows } = await admin
    .from("quotas")
    .select("target_amount")
    .eq("organization_id", orgId)
    .eq("period", period);
  const quota = (quotaRows ?? []).reduce((s, q) => s + Number(q.target_amount ?? 0), 0);

  const committedToGoal = closed.amount + commit.weighted;
  const attainment = quota > 0 ? Math.round((committedToGoal / quota) * 100) : null;

  let verdict: string;
  let priority = "medium";
  if (quota > 0) {
    const gap = quota - committedToGoal;
    if (attainment! >= 100) {
      verdict = `${period}: on track. Closed ${money(closed.amount)} + weighted commit ${money(commit.weighted)} = ${money(committedToGoal)} against a ${money(quota)} quota (${attainment}%). Best-case adds ${money(bestCase.weighted)}.`;
      priority = "low";
    } else {
      verdict = `${period}: ${attainment}% to quota. Closed ${money(closed.amount)} + weighted commit ${money(commit.weighted)} leaves a ${money(gap)} gap on ${money(quota)}. Best-case upside ${money(bestCase.weighted)} across ${bestCase.count} deals — pull the winnable ones into commit.`;
      priority = attainment! < 60 ? "high" : "medium";
    }
  } else {
    verdict = `${period}: no quota set. Closed ${money(closed.amount)}, weighted commit ${money(commit.weighted)}, best-case ${money(bestCase.weighted)}. Set a quota to track attainment.`;
  }

  await admin
    .from("mentor_insights")
    .delete()
    .eq("org_id", orgId)
    .eq("agent_id", AGENT_ID)
    .eq("type", "recommendation")
    .gte("created_at", startOfDay.toISOString());
  await admin.from("mentor_insights").insert({
    org_id: orgId,
    agent_id: AGENT_ID,
    type: "recommendation",
    title: `Forecast verdict — ${period}`,
    detail: verdict,
    priority,
  });

  return rows.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  let body: { internal?: boolean; org_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const internal = body.internal === true && token === serviceKey;

  // Internal cron: roll up every org.
  if (internal && !body.org_id) {
    const { data: orgs } = await admin.from("organizations").select("id").limit(5000);
    let n = 0;
    for (const o of orgs ?? []) {
      try {
        await rollupOrg(admin, o.id as string);
        n++;
      } catch {
        /* keep going */
      }
    }
    return json({ ok: true, orgs_rolled_up: n });
  }

  // Otherwise a member rolls up their own org.
  if (!authHeader) return json({ error: "Missing auth" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let orgId = body.org_id ?? null;
  if (orgId) {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!m) return json({ error: "Forbidden" }, 403);
  } else {
    const { data: m } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!m) return json({ error: "No organization" }, 403);
    orgId = m.organization_id as string;
  }

  await rollupOrg(admin, orgId);
  return json({ ok: true, period: currentPeriod() });
});
