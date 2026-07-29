// weekly-review — generates the Weekly Operating Review.
//
// Two invocation modes:
//   * user (JWT): generate/refresh the review for the caller's org on demand
//   * cron (service role, {"mode":"cron"}): generate for every org with
//     activity in the last 7 days (bounded batch per run)
//
// The review is grounded in the Business Context Graph + the week's actual
// activity (tool runs, mission steps, leads) — never generic advice.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { assembleContext } from "../_shared/context.ts";
import { callClaude } from "../_shared/helpers.ts";

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

const REVIEW_SCHEMA = {
  name: "weekly_review",
  description: "Structured weekly operating review for this specific business.",
  parameters: {
    type: "object",
    properties: {
      headline: { type: "string", description: "One sharp sentence on the week" },
      momentum: {
        type: "string",
        enum: ["accelerating", "steady", "stalling"],
        description: "Overall trajectory verdict",
      },
      wins: { type: "array", items: { type: "string" }, description: "2-4 concrete wins" },
      stalls: {
        type: "array",
        items: { type: "string" },
        description: "1-3 places progress stalled, named bluntly",
      },
      focus_next_week: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            reason: { type: "string" },
          },
          required: ["title", "reason"],
        },
        description: "Top 3 moves for next week, ranked by leverage",
      },
    },
    required: ["headline", "momentum", "wins", "stalls", "focus_next_week"],
  },
};

function weekStartISO(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff),
  );
  return monday.toISOString().slice(0, 10);
}

async function weekStats(admin: SupabaseClient, orgId: string) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [runs, leads] = await Promise.all([
    admin
      .from("tool_runs")
      .select("tool_key, status")
      .eq("organization_id", orgId)
      .gte("created_at", since),
    admin.from("leads").select("id, stage").eq("organization_id", orgId).gte("created_at", since),
  ]);
  const runRows = runs.data ?? [];
  const byTool = new Map<string, number>();
  for (const r of runRows)
    byTool.set(r.tool_key as string, (byTool.get(r.tool_key as string) ?? 0) + 1);
  return {
    runs_total: runRows.length,
    runs_succeeded: runRows.filter((r) => r.status === "succeeded").length,
    tools_used: [...byTool.entries()].map(([k, n]) => `${k}×${n}`).join(", ") || "none",
    new_leads: (leads.data ?? []).length,
  };
}

async function generateForOrg(admin: SupabaseClient, orgId: string): Promise<boolean> {
  const stats = await weekStats(admin, orgId);
  const assembled = await assembleContext(admin, orgId, { budgetChars: 4000 }).catch(() => ({
    block: "",
    used: [] as string[],
  }));

  const output = await callClaude(
    "You are Bylda, the AI operating system for this business. Write their weekly operating review. " +
      "Be specific to THEIR business and THEIR actual week — reference real numbers from the activity " +
      "summary and real facts from context. Blunt about stalls, concrete about next week. No filler.",
    `${assembled.block}\n\n## THIS WEEK'S ACTUAL ACTIVITY\n` +
      `Tool runs: ${stats.runs_total} (${stats.runs_succeeded} succeeded)\n` +
      `Tools used: ${stats.tools_used}\n` +
      `New leads added: ${stats.new_leads}\n\n` +
      `Write the weekly review.`,
    REVIEW_SCHEMA,
  );

  const { error } = await admin.from("weekly_reviews").upsert(
    {
      organization_id: orgId,
      week_start: weekStartISO(),
      payload: output,
      model: "claude",
    },
    { onConflict: "organization_id,week_start" },
  );
  return !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: { mode?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // ── Cron mode: service-role call, batch over recently-active orgs ─────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (body.mode === "cron" && authHeader.includes(serviceKey)) {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: activeOrgs } = await admin
      .from("tool_runs")
      .select("organization_id")
      .gte("created_at", since)
      .limit(500);
    const orgIds = [...new Set((activeOrgs ?? []).map((r) => r.organization_id as string))].slice(
      0,
      20,
    );
    let ok = 0;
    for (const orgId of orgIds) {
      try {
        if (await generateForOrg(admin, orgId)) ok++;
      } catch (e) {
        console.error("[weekly-review] org failed:", orgId, e instanceof Error ? e.message : e);
      }
    }
    return json({ processed: ok, candidates: orgIds.length });
  }

  // ── User mode: generate for the caller's org on demand ────────────────────
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);

  const { data: member } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return json({ error: "No organization" }, 403);
  const orgId = member.organization_id as string;

  try {
    const ok = await generateForOrg(admin, orgId);
    if (!ok) return json({ error: "Could not save review" }, 500);
    const { data: review } = await admin
      .from("weekly_reviews")
      .select("*")
      .eq("organization_id", orgId)
      .order("week_start", { ascending: false })
      .limit(1);
    return json({ ok: true, review: review?.[0] ?? null });
  } catch (e) {
    console.error("[weekly-review] error:", e instanceof Error ? e.message : e);
    return json({ error: "Review generation failed. Please try again." }, 500);
  }
});
