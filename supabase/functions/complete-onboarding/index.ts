// complete-onboarding — server-side onboarding completion saga.
//
// Replaces the fragile client-orchestrated chain in onboarding.tsx with one
// idempotent server call:
//   1. ensure org + membership
//   2. classify lane (mode-aware)
//   3. provision workspace + first mission/baseline ATOMICALLY (provision_workspace_tx)
//   4. write the Business Context Graph (business_context)
//   5. write-through legacy tables (onboarding_responses, workspace_intake)
//   6. flag profiles.onboarding_complete
//   7. mark onboarding_session completed + log activation events
//   8. kick AI dashboard generation in the background (EdgeRuntime.waitUntil)
//
// Any failure before step 6 returns an error WITHOUT flagging the profile, so
// the user is never stranded "onboarded" with a half-provisioned workspace.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  buildMissionSeed,
  buildOperatorBaseline,
  classifyLaneServer,
  type Lane,
  type MissionSeed,
} from "../_shared/missionSeeds.ts";

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

type Mode = "create" | "operate";

interface CompleteBody {
  mode?: Mode;
  answers?: Record<string, unknown>;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const VALID_STAGES = ["Idea", "Validate", "Launch", "Operate", "Scale"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  let body: CompleteBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const mode: Mode = body.mode === "operate" ? "operate" : "create";
  const a = body.answers ?? {};

  // ── Validate the minimum viable context per track ─────────────────────────
  if (mode === "create" && !str(a.idea)) {
    return json({ error: "Tell Bylda your business idea first.", code: "MISSING_IDEA" }, 400);
  }
  if (mode === "operate" && !str(a.business_name)) {
    return json({ error: "Tell Bylda your business name first.", code: "MISSING_NAME" }, 400);
  }

  // ── Normalize answers into a single shape ──────────────────────────────────
  const idea = str(a.idea) || str(a.business_description);
  const businessName = str(a.business_name);
  const rawStage = str(a.stage);
  const stage = VALID_STAGES.includes(rawStage)
    ? rawStage
    : mode === "operate"
      ? "Operate"
      : "Idea";
  const targetCustomer = str(a.target_customer);
  const goal = str(a.goal) || str(a.scale_goal);
  // Detection answers (has_revenue / team_size_detect) arrive merged into
  // `answers` and act as fallbacks so BOTH tracks populate stage signals.
  const revenue = str(a.revenue) || str(a.revenue_band) || str(a.has_revenue);
  const teamSize = str(a.team_size) || str(a.team_size_detect);
  const challenge = str(a.challenge) || strArr(a.bottlenecks)[0] || "";
  const industry = str(a.industry);
  const niche = str(a.niche) || targetCustomer;
  const monetization = str(a.monetization) || str(a.service_model);

  const lane: Lane = classifyLaneServer({
    mode,
    stage,
    challenge,
    goal,
    revenueBand: revenue,
  });

  // ── 1. Ensure org + membership (idempotent) ───────────────────────────────
  const { data: existingMember } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  let orgId: string;
  if (existingMember) {
    orgId = existingMember.organization_id as string;
    await admin
      .from("organizations")
      .update({
        name: businessName || undefined,
        stage,
        niche: niche || undefined,
        target_customer: targetCustomer || undefined,
        offer: idea || undefined,
        goal: goal || undefined,
      })
      .eq("id", orgId);
  } else {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name: businessName || "My Workspace",
        owner_id: userId,
        stage,
        niche: niche || null,
        target_customer: targetCustomer || null,
        offer: idea || null,
        goal: goal || null,
      })
      .select("id")
      .single();
    if (orgErr) return json({ error: `Could not create workspace: ${orgErr.message}` }, 500);
    orgId = org.id as string;

    const { error: memberErr } = await admin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role: "owner" });
    if (memberErr) return json({ error: `Could not join workspace: ${memberErr.message}` }, 500);
  }

  // ── 2-3. Provision workspace + mission atomically ─────────────────────────
  const seed: MissionSeed =
    mode === "operate"
      ? buildOperatorBaseline(businessName, strArr(a.bottlenecks), strArr(a.reporting_gaps))
      : buildMissionSeed(lane, idea);

  const { data: provision, error: provisionErr } = await admin.rpc("provision_workspace_tx", {
    p_organization_id: orgId,
    p_owner_id: userId,
    p_name: businessName || "My Workspace",
    p_lane: lane,
    p_stage: stage,
    p_mode: mode,
    p_mission: seed,
  });

  if (provisionErr) {
    return json(
      { error: `Workspace provisioning failed: ${provisionErr.message}`, code: "PROVISION_FAILED" },
      500,
    );
  }
  const workspaceId = (provision as { workspace_id?: string })?.workspace_id ?? null;
  const missionId = (provision as { mission_id?: string })?.mission_id ?? null;

  // ── 4. Business Context Graph ──────────────────────────────────────────────
  const { error: contextErr } = await admin.from("business_context").upsert(
    {
      organization_id: orgId,
      workspace_id: workspaceId,
      identity: {
        name: businessName || null,
        description: idea || null,
        industry: industry || null,
        niche: niche || null,
        mode,
      },
      customer: {
        target: targetCustomer || null,
        description: str(a.customer_description) || null,
      },
      stage: {
        stage,
        lane,
        revenue_band: revenue || null,
        team_size: teamSize || null,
      },
      model: {
        monetization: monetization || null,
        fulfillment: str(a.fulfillment) || null,
        company_type: str(a.company_type) || null,
      },
      goals: {
        goal_90d: str(a.goal) || null,
        scale_goal: str(a.scale_goal) || null,
        timeline: str(a.timeline) || null,
      },
      constraints: {
        time: str(a.time_constraint) || null,
        budget: str(a.budget) || null,
        experience: str(a.experience) || null,
        assets: strArr(a.assets),
      },
      motion: {
        channels: strArr(a.channels),
        sales_maturity: str(a.sales_maturity) || null,
        bottlenecks: strArr(a.bottlenecks),
        tool_stack: strArr(a.tool_stack),
        reporting_gaps: strArr(a.reporting_gaps),
        automation_appetite: str(a.automation_appetite) || null,
      },
      activity: { onboarded_at: new Date().toISOString() },
    },
    { onConflict: "organization_id" },
  );
  if (contextErr) {
    // Context is foundational but the workspace exists — log loudly, continue.
    console.error("[complete-onboarding] business_context write failed:", contextErr.message);
  }

  // ── 5. Legacy write-through (generate-ai-dashboard reads onboarding_responses)
  await admin.from("onboarding_responses").upsert(
    {
      user_id: userId,
      organization_id: orgId,
      offer: idea || businessName,
      niche,
      target_customer: targetCustomer,
      goal,
      current_revenue: revenue,
      stage,
      biggest_blocker: challenge,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (workspaceId) {
    await admin.from("workspace_intake").upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        idea: idea || businessName,
        stage,
        challenge,
        lane,
        raw_answers: a,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );
  }

  // ── 6. Flag profile complete (the /app gate) ───────────────────────────────
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", userId);
  if (profileErr) {
    return json({ error: `Could not finish onboarding: ${profileErr.message}` }, 500);
  }

  // ── 7. Session + activation events (best-effort) ───────────────────────────
  await Promise.allSettled([
    admin.from("onboarding_sessions").update({ status: "completed" }).eq("user_id", userId),
    admin.from("activation_events").insert([
      {
        user_id: userId,
        workspace_id: workspaceId,
        event_name: "onboarding_complete",
        properties: { mode, lane, stage, challenge, goal, has_idea: idea.length > 0 },
      },
      {
        user_id: userId,
        workspace_id: workspaceId,
        event_name: "workspace_created",
        properties: { organization_id: orgId, mode, lane, stage },
      },
      ...(missionId
        ? [
            {
              user_id: userId,
              workspace_id: workspaceId,
              event_name: "first_mission_assigned",
              properties: { mission_id: missionId, mission_title: seed.title, lane, mode },
            },
          ]
        : []),
    ]),
  ]);

  // ── 8. AI dashboard generation in the background (1 retry) ────────────────
  const generateDashboard = async () => {
    const call = () =>
      fetch(`${supabaseUrl}/functions/v1/generate-ai-dashboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          business: idea || businessName,
          niche,
          stage,
          goal,
          current_revenue: revenue,
          target_customer: targetCustomer,
          biggest_blocker: challenge,
          organization_id: orgId,
        }),
      });
    try {
      const first = await call();
      if (!first.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        await call();
      }
    } catch (e) {
      console.error("[complete-onboarding] dashboard generation failed:", e);
    }
  };

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(generateDashboard());
  else generateDashboard().catch(() => {});

  return json({
    ok: true,
    organization_id: orgId,
    workspace_id: workspaceId,
    mission_id: missionId,
    lane,
    mode,
    mission_title: seed.title,
  });
});
