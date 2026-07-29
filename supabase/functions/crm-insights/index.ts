// crm-insights — reads pipeline health and writes coaching signals into
// mentor_insights under Mo Latif (the revenue/pipeline mentor). Detects:
//   • stalled deals — open leads with no activity for N days
//   • time-in-stage outliers — deals sitting in a stage far longer than the
//     org's median for that stage (from deal_stage_history)
// Runs on demand (from the CRM) or on a schedule. Idempotent per day: it clears
// the day's prior stalled/velocity insights for the org before rewriting, so
// re-running never piles up duplicates.
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

const AGENT_ID = "mo-latif";
const STALL_DAYS = 7;
const OPEN_STAGES = ["New", "Contacted", "Qualified", "Proposal"];

type Insight = {
  org_id: string;
  agent_id: string;
  type: string;
  title: string;
  detail: string;
  priority: string;
};

async function buildInsights(admin: SupabaseClient, orgId: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = Date.now();
  const stallCutoff = new Date(now - STALL_DAYS * 86400_000).toISOString();

  // ── Stalled deals: open, untouched for STALL_DAYS ──────────────────────────
  const { data: stalled } = await admin
    .from("leads")
    .select("id, name, stage, value, last_activity_at, updated_at, created_at")
    .eq("organization_id", orgId)
    .in("stage", OPEN_STAGES)
    .order("value", { ascending: false, nullsFirst: false })
    .limit(200);

  const stalledDeals = (stalled ?? []).filter((l) => {
    const last = l.last_activity_at ?? l.updated_at ?? l.created_at;
    return last != null && last < stallCutoff;
  });

  for (const d of stalledDeals.slice(0, 10)) {
    const last = d.last_activity_at ?? d.updated_at ?? d.created_at;
    const days = Math.floor((now - new Date(last as string).getTime()) / 86400_000);
    const value = d.value ? ` ($${Number(d.value).toLocaleString()})` : "";
    insights.push({
      org_id: orgId,
      agent_id: AGENT_ID,
      type: "warning",
      title: `${d.name} has gone quiet`,
      detail: `This deal${value} has sat in ${d.stage} with no activity for ${days} days. Send a re-engagement touch today or mark it lost so your pipeline reflects reality.`,
      priority: d.value && Number(d.value) > 0 ? "high" : "medium",
    });
  }

  // ── Time-in-stage outliers: current stage age vs org median for that stage ──
  const { data: history } = await admin
    .from("deal_stage_history")
    .select("from_stage, duration_seconds")
    .eq("organization_id", orgId)
    .not("duration_seconds", "is", null)
    .limit(2000);

  const byStage = new Map<string, number[]>();
  for (const h of history ?? []) {
    if (!h.from_stage) continue;
    const arr = byStage.get(h.from_stage) ?? [];
    arr.push(Number(h.duration_seconds));
    byStage.set(h.from_stage, arr);
  }
  const median = (nums: number[]) => {
    if (nums.length === 0) return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  // Age of each open deal in its CURRENT stage = now - last stage change (or created_at).
  for (const d of stalled ?? []) {
    const med = median(byStage.get(d.stage as string) ?? []);
    if (med == null || med <= 0) continue;
    const { data: lastChange } = await admin
      .from("deal_stage_history")
      .select("changed_at")
      .eq("lead_id", d.id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const since = lastChange?.changed_at ?? d.created_at;
    const ageSec = (now - new Date(since as string).getTime()) / 1000;
    // Flag deals sitting ≥ 2× the median time for their stage.
    if (ageSec >= med * 2 && ageSec > 3 * 86400) {
      const days = Math.floor(ageSec / 86400);
      const medDays = Math.max(1, Math.round(med / 86400));
      insights.push({
        org_id: orgId,
        agent_id: AGENT_ID,
        type: "signal",
        title: `${d.name} is stuck in ${d.stage}`,
        detail: `It's been ${days} days in ${d.stage} — your typical ${d.stage} deal moves in ~${medDays}. Either advance it with a concrete next step or diagnose the blocker.`,
        priority: "medium",
      });
    }
  }

  return insights;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { org_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Resolve + verify org membership.
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

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const insights = await buildInsights(admin, orgId);

  // Idempotent per day: clear today's prior pipeline insights for this agent,
  // then insert the fresh set so re-runs don't duplicate.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  await admin
    .from("mentor_insights")
    .delete()
    .eq("org_id", orgId)
    .eq("agent_id", AGENT_ID)
    .in("type", ["warning", "signal"])
    .gte("created_at", startOfDay.toISOString());

  if (insights.length > 0) {
    await admin.from("mentor_insights").insert(insights);
  }

  return json({ ok: true, insights_written: insights.length });
});
