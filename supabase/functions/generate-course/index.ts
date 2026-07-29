// generate-course — builds a founder's personalized course when they APPROVE
// their Founder Casefile. This is the successor to the retired generate-playbook,
// but it writes to the LIVE mission spine (missions / mission_steps) instead of
// the retired playbook_lessons — no parallel tracker.
//
//   module      = mission        (one per stage, owned by a mentor)
//   module step = mission_step    (each points at a real, clickable tool route)
//
// Completion flows through the existing advance-mission function, which already
// dual-writes step.completed / mission.completed to bylda_events. This function
// only generates the structure and flips the casefile to 'approved'.
//
// The lesson spine + mentor delegation is reused verbatim from
// _shared/curriculum.ts (buildLessons) — the same engine the school layer has
// always used — grouped into modules by stage.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  buildLessons,
  classifyBusinessModel,
  STAGE_ORDER,
  type BusinessModel,
  type Stage,
} from "../_shared/curriculum.ts";

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

// Founder-facing module title per stage (curriculum language, not tool names).
// Mirrors STAGE_MODULE_LABELS in src/lib/mentors.ts.
const STAGE_MODULE_LABELS: Record<Stage, string> = {
  Idea: "Clarify the idea",
  Validate: "Offer & proof",
  Launch: "First customers",
  Operate: "Run the machine",
  Scale: "Compound growth",
};

// Module intro line per stage, in plain language.
const STAGE_MODULE_INTRO: Record<Stage, string> = {
  Idea: "Lock down what you're building and who it's for before anything else.",
  Validate: "Turn the idea into an offer people will actually pay for.",
  Launch: "Get your first real customers through the door.",
  Operate: "Build the systems that run the business without you.",
  Scale: "Compound what works into durable growth.",
};

// missions.lane is the workspace_lane enum (Idea | Offer | Customer | Systems).
const STAGE_LANE: Record<Stage, string> = {
  Idea: "Idea",
  Validate: "Offer",
  Launch: "Customer",
  Operate: "Systems",
  Scale: "Systems",
};

interface CasefileRun {
  id: string;
  organization_id: string;
  tool_key: string;
  input: Record<string, unknown> | null;
  casefile_status: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: { casefile_run_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.casefile_run_id) return json({ error: "casefile_run_id is required" }, 400);

  // ── Load the casefile, scoped to a workspace the caller owns ───────────────
  const { data: run } = await admin
    .from("tool_runs")
    .select("id, organization_id, tool_key, input, casefile_status")
    .eq("id", body.casefile_run_id)
    .maybeSingle();
  if (!run) return json({ error: "Casefile not found" }, 404);
  const casefile = run as CasefileRun;

  const { data: ws } = await admin
    .from("workspaces")
    .select("id, organization_id, owner_id, stage")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!ws) return json({ error: "No workspace for user" }, 404);
  if (ws.organization_id !== casefile.organization_id)
    return json({ error: "Casefile does not belong to your workspace" }, 403);

  // ── Idempotency — a course already exists for this workspace ───────────────
  const { data: existing } = await admin
    .from("missions")
    .select("id")
    .eq("workspace_id", ws.id)
    .not("generated_from_casefile_id", "is", null)
    .limit(1);
  if (existing && existing.length > 0) {
    // Still make sure the casefile shows approved, then no-op.
    await admin
      .from("tool_runs")
      .update({ casefile_status: "approved", casefile_approved_at: new Date().toISOString() })
      .eq("id", casefile.id);
    return json({ ok: true, already_generated: true });
  }

  // ── Resolve stage + business model ─────────────────────────────────────────
  const stage: Stage = STAGE_ORDER.includes(ws.stage as Stage) ? (ws.stage as Stage) : "Idea";

  const { data: ctx } = await admin
    .from("business_context")
    .select("identity, customer, model, goals")
    .eq("organization_id", casefile.organization_id)
    .maybeSingle();
  // business_context stores jsonb blobs; flatten the relevant ones plus the
  // casefile's own input into one bag the classifier can read from.
  const bag: Record<string, unknown> = {
    ...asObj(ctx?.model),
    ...asObj(ctx?.identity),
    ...asObj(ctx?.customer),
    ...asObj(ctx?.goals),
    ...(casefile.input ?? {}),
  };
  const signals = {
    monetization: str(bag.monetization),
    industry: str(bag.industry),
    idea: str(bag.idea ?? bag.description ?? bag.business_description),
    niche: str(bag.niche ?? bag.target_customer),
  };
  const model: BusinessModel = classifyBusinessModel(signals);

  // ── Build the lesson spine, then group into modules by stage ───────────────
  const lessons = buildLessons(model, stage);

  const byStage = new Map<Stage, typeof lessons>();
  for (const l of lessons) {
    const arr = byStage.get(l.stage) ?? [];
    arr.push(l);
    byStage.set(l.stage, arr);
  }
  const orderedStages = STAGE_ORDER.filter((s) => byStage.has(s));

  // ── Pause any pre-existing ad-hoc (non-course) active missions so the course
  //    becomes the single source of "what's next". Reversible status change. ──
  await admin
    .from("missions")
    .update({ status: "paused" })
    .eq("workspace_id", ws.id)
    .eq("status", "active")
    .is("generated_from_casefile_id", null);

  // ── Insert modules (missions) + steps (mission_steps) ──────────────────────
  let firstModuleId: string | null = null;
  const nowIso = new Date().toISOString();

  for (let m = 0; m < orderedStages.length; m++) {
    const st = orderedStages[m];
    const group = byStage.get(st)!;
    const mentorOwner = dominantMentor(group.map((g) => g.mentorId));
    const moduleStatus = m === 0 ? "active" : "locked";

    const { data: mission, error: mErr } = await admin
      .from("missions")
      .insert({
        workspace_id: ws.id,
        title: STAGE_MODULE_LABELS[st],
        description: STAGE_MODULE_INTRO[st],
        lane: STAGE_LANE[st],
        status: moduleStatus,
        sort_order: m,
        mentor_owner: mentorOwner,
        generated_from_casefile_id: casefile.id,
        unlock_condition: m === 0 ? null : `complete_module:${m - 1}`,
      })
      .select("id")
      .single();
    if (mErr || !mission) return json({ error: mErr?.message ?? "Module insert failed" }, 500);
    if (m === 0) firstModuleId = mission.id;

    const steps = group.map((lesson, i) => ({
      mission_id: mission.id,
      title: lesson.title,
      description: lesson.summary,
      instruction: lesson.summary,
      tool_key: lesson.toolKey,
      target_ui_ref: `/app/launchpad/${lesson.toolKey}`,
      action_type: "navigate",
      completion_event: "step.completed",
      status: "pending",
      sort_order: i,
    }));
    const { error: sErr } = await admin.from("mission_steps").insert(steps);
    if (sErr) return json({ error: sErr.message }, 500);
  }

  // ── Point the workspace at the first module + flip casefile approved ───────
  if (firstModuleId) {
    await admin.from("workspaces").update({ current_mission_id: firstModuleId }).eq("id", ws.id);
  }
  await admin
    .from("tool_runs")
    .update({ casefile_status: "approved", casefile_approved_at: nowIso })
    .eq("id", casefile.id);

  // Announce the course build on the event ledger (same best-effort pattern as
  // advance-mission's bylda_events dual-writes).
  await admin
    .from("bylda_events")
    .insert({
      organization_id: casefile.organization_id,
      source: "course",
      event_type: "course.generated",
      subject_type: "workspace",
      subject_id: ws.id,
      payload: { casefile_run_id: casefile.id, modules: orderedStages.length, stage, model },
    })
    .then(
      () => {},
      () => {},
    );

  return json({ ok: true, modules: orderedStages.length, first_module_id: firstModuleId });
});

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// The mentor who owns the most steps in a module owns the module. Ties break
// toward the first occurrence (which follows curriculum ordering).
function dominantMentor(ids: string[]): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best = ids[0];
  let bestN = -1;
  for (const id of ids) {
    const n = counts.get(id)!;
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  }
  return best;
}
