// next-best-action — the unified copilot read across the whole CRM. Rather than
// six siloed AI features, this one engine scans leads, conversations (messages),
// customer_accounts and forecast_snapshots, scores candidate actions, and
// returns a single ranked to-do. It also mirrors the top items into
// mentor_insights so they surface on the copilot layer. Read-only against the
// data (only writes advisory insights). On-demand per org.
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

const DAY = 86400_000;
const OPEN_STAGES = ["New", "Contacted", "Qualified", "Proposal"];

type Action = {
  kind: string;
  title: string;
  detail: string;
  score: number;
  entity_type: string;
  entity_id: string;
};

async function buildActions(admin: SupabaseClient, orgId: string): Promise<Action[]> {
  const now = Date.now();
  const actions: Action[] = [];

  // 1. Open deals — stalled (no activity) or hot (high probability, needs a push).
  const { data: leads } = await admin
    .from("leads")
    .select("id, name, stage, value, probability, last_activity_at, updated_at, created_at")
    .eq("organization_id", orgId)
    .in("stage", OPEN_STAGES)
    .limit(500);
  for (const l of leads ?? []) {
    const last = l.last_activity_at ?? l.updated_at ?? l.created_at;
    const idleDays = last ? (now - new Date(last as string).getTime()) / DAY : 999;
    const value = Number(l.value ?? 0);
    const prob = Number(l.probability ?? 0);
    if (idleDays >= 5) {
      // Value + staleness raise the score; a hot deal going cold ranks highest.
      const score = Math.min(100, 40 + idleDays * 2 + prob / 4 + (value > 0 ? 10 : 0));
      actions.push({
        kind: "follow_up_deal",
        title: `Follow up: ${l.name}`,
        detail: `${Math.floor(idleDays)}d since last touch in ${l.stage}${value ? ` · $${value.toLocaleString()}` : ""}. Re-engage or advance it.`,
        score,
        entity_type: "lead",
        entity_id: l.id as string,
      });
    }
  }

  // 2. Unreplied inbound messages (conversations) — fast follow wins deals.
  const { data: inbound } = await admin
    .from("conversations")
    .select("id, contact_id, channel, body, created_at, status")
    .eq("organization_id", orgId)
    .eq("direction", "inbound")
    .in("status", ["open", "read"])
    .order("created_at", { ascending: false })
    .limit(100);
  for (const m of inbound ?? []) {
    const ageH = (now - new Date(m.created_at as string).getTime()) / 3600_000;
    if (ageH > 0.5 && ageH < 24 * 14) {
      const score = Math.min(100, 70 - ageH); // fresher = higher; decays over time
      actions.push({
        kind: "reply_message",
        title: `Reply on ${m.channel}`,
        detail: `Inbound ${ageH < 24 ? `${Math.round(ageH)}h` : `${Math.round(ageH / 24)}d`} ago: "${String(m.body ?? "").slice(0, 80)}"`,
        score,
        entity_type: "conversation",
        entity_id: m.id as string,
      });
    }
  }

  // 3. At-risk customers — protect revenue.
  const { data: accounts } = await admin
    .from("customer_accounts")
    .select("id, name, health_score, mrr, renewal_date, stage")
    .eq("organization_id", orgId)
    .eq("stage", "at_risk")
    .limit(200);
  for (const a of accounts ?? []) {
    const mrr = Number(a.mrr ?? 0);
    const renewalDays = a.renewal_date
      ? (new Date(a.renewal_date as string).getTime() - now) / DAY
      : null;
    const urgency = renewalDays != null && renewalDays <= 45 ? 20 : 0;
    const score = Math.min(
      100,
      55 + (70 - Number(a.health_score ?? 70)) + urgency + (mrr > 0 ? 10 : 0),
    );
    actions.push({
      kind: "save_account",
      title: `Save at-risk: ${a.name}`,
      detail: `Health ${a.health_score}/100${mrr ? ` · $${mrr.toLocaleString()} MRR` : ""}${renewalDays != null ? ` · renews in ${Math.round(renewalDays)}d` : ""}. Book a value check-in.`,
      score,
      entity_type: "customer_account",
      entity_id: a.id as string,
    });
  }

  // 4. Forecast gap — nudge toward the number (org-level, single action).
  const { data: snap } = await admin
    .from("forecast_snapshots")
    .select("forecast_category, weighted_amount, period, captured_at")
    .eq("organization_id", orgId)
    .order("captured_at", { ascending: false })
    .limit(10);
  const bestCase = (snap ?? []).find((s) => s.forecast_category === "best_case");
  if (bestCase && Number(bestCase.weighted_amount) > 0) {
    actions.push({
      kind: "work_best_case",
      title: "Convert best-case pipeline",
      detail: `$${Math.round(Number(bestCase.weighted_amount)).toLocaleString()} weighted in best-case for ${bestCase.period}. Pull the winnable deals into commit.`,
      score: 50,
      entity_type: "forecast",
      entity_id: String(bestCase.period),
    });
  }

  return actions.sort((a, b) => b.score - a.score).slice(0, 15);
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

  let body: { org_id?: string; persist?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

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

  const actions = await buildActions(admin, orgId);

  // Optionally mirror the top actions onto the copilot layer (idempotent/day).
  if (body.persist) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    await admin
      .from("mentor_insights")
      .delete()
      .eq("org_id", orgId)
      .eq("agent_id", "mo-latif")
      .eq("type", "recommendation")
      .like("title", "Next best action%")
      .gte("created_at", startOfDay.toISOString());
    const rows = actions.slice(0, 5).map((a) => ({
      org_id: orgId,
      agent_id: "mo-latif",
      type: "recommendation",
      title: `Next best action: ${a.title}`,
      detail: a.detail,
      priority: a.score >= 75 ? "high" : a.score >= 55 ? "medium" : "low",
    }));
    if (rows.length) await admin.from("mentor_insights").insert(rows);
  }

  return json({ ok: true, actions });
});
