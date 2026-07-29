// cs-health — recomputes customer health + churn risk from adoption recency and
// engagement recency, updates customer_accounts.health_score/stage, and raises
// at-risk signals (renewal proximity + low health) under Mo Latif (retention).
// On-demand from Customer Success, or nightly via cron (internal, all orgs).
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
const DAY = 86400_000;

type Account = {
  id: string;
  organization_id: string;
  company_id: string | null;
  name: string;
  stage: string;
  health_score: number;
  mrr: number;
  renewal_date: string | null;
};

function daysSince(ts: string | null | undefined): number | null {
  if (!ts) return null;
  return (Date.now() - new Date(ts).getTime()) / DAY;
}

async function scoreAccount(admin: SupabaseClient, acc: Account): Promise<number> {
  let score = 70;

  // ── Adoption recency (strongest signal) ────────────────────────────────────
  const { data: lastEvent } = await admin
    .from("adoption_events")
    .select("occurred_at")
    .eq("customer_account_id", acc.id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const adoptDays = daysSince(lastEvent?.occurred_at);
  if (adoptDays == null)
    score -= 20; // never seen product usage
  else if (adoptDays <= 7) score += 18;
  else if (adoptDays <= 30) score += 6;
  else if (adoptDays <= 90) score -= 12;
  else score -= 25;

  // Event volume in the last 30 days (momentum).
  const { count: recentCount } = await admin
    .from("adoption_events")
    .select("id", { count: "exact", head: true })
    .eq("customer_account_id", acc.id)
    .gte("occurred_at", new Date(Date.now() - 30 * DAY).toISOString());
  if ((recentCount ?? 0) >= 10) score += 8;
  else if ((recentCount ?? 0) === 0) score -= 8;

  // ── Engagement recency (inbound messages from the account's contacts) ──────
  if (acc.company_id) {
    const { data: contacts } = await admin
      .from("contacts")
      .select("id")
      .eq("company_id", acc.company_id)
      .limit(200);
    const contactIds = (contacts ?? []).map((c) => c.id as string);
    if (contactIds.length) {
      const { data: lastMsg } = await admin
        .from("conversations")
        .select("created_at")
        .eq("direction", "inbound")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const msgDays = daysSince(lastMsg?.created_at);
      if (msgDays == null) score -= 5;
      else if (msgDays <= 14) score += 8;
      else if (msgDays > 45) score -= 8;
    }
  }

  // ── Renewal proximity risk ─────────────────────────────────────────────────
  const renewalDays = acc.renewal_date
    ? (new Date(acc.renewal_date).getTime() - Date.now()) / DAY
    : null;
  if (renewalDays != null && renewalDays <= 30 && score < 65) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function refreshOrg(admin: SupabaseClient, orgId: string): Promise<number> {
  const { data: accounts } = await admin
    .from("customer_accounts")
    .select("id, organization_id, company_id, name, stage, health_score, mrr, renewal_date")
    .eq("organization_id", orgId)
    .neq("stage", "churned")
    .limit(2000);

  const atRisk: { name: string; score: number; mrr: number; renewalDays: number | null }[] = [];

  for (const acc of (accounts ?? []) as Account[]) {
    const score = await scoreAccount(admin, acc);
    // Auto stage: at_risk below 45; recover to active at 60+. Never touch
    // onboarding (manual graduation) unless it has clearly gone at-risk.
    let stage = acc.stage;
    if (score < 45) stage = "at_risk";
    else if (acc.stage === "at_risk" && score >= 60) stage = "active";

    await admin.from("customer_accounts").update({ health_score: score, stage }).eq("id", acc.id);

    const renewalDays = acc.renewal_date
      ? Math.round((new Date(acc.renewal_date).getTime() - Date.now()) / DAY)
      : null;
    if (stage === "at_risk") atRisk.push({ name: acc.name, score, mrr: acc.mrr, renewalDays });
  }

  // Refresh today's churn-risk signals (idempotent per day).
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  await admin
    .from("mentor_insights")
    .delete()
    .eq("org_id", orgId)
    .eq("agent_id", AGENT_ID)
    .eq("type", "warning")
    .gte("created_at", startOfDay.toISOString())
    .like("title", "Churn risk%");

  const insights = atRisk
    .sort((a, b) => b.mrr - a.mrr || a.score - b.score)
    .slice(0, 10)
    .map((a) => {
      const mrr = a.mrr > 0 ? ` ($${Math.round(a.mrr).toLocaleString()} MRR)` : "";
      const renewal =
        a.renewalDays != null
          ? a.renewalDays <= 0
            ? " Renewal is past due."
            : ` Renews in ${a.renewalDays} days.`
          : "";
      return {
        org_id: orgId,
        agent_id: AGENT_ID,
        type: "warning",
        title: `Churn risk: ${a.name}`,
        detail: `Health dropped to ${a.score}/100${mrr}.${renewal} Reach out with a value check-in and log the next step.`,
        priority: a.mrr > 0 && (a.renewalDays == null || a.renewalDays <= 45) ? "high" : "medium",
      };
    });
  if (insights.length) await admin.from("mentor_insights").insert(insights);

  return (accounts ?? []).length;
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

  if (internal && !body.org_id) {
    const { data: orgs } = await admin.from("organizations").select("id").limit(5000);
    let n = 0;
    for (const o of orgs ?? []) {
      try {
        await refreshOrg(admin, o.id as string);
        n++;
      } catch {
        /* keep going */
      }
    }
    return json({ ok: true, orgs_scored: n });
  }

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

  const scored = await refreshOrg(admin, orgId);
  return json({ ok: true, accounts_scored: scored });
});
