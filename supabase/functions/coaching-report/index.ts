// coaching-report — writes a one-page coaching note for one rep over a period.
// Authenticates the user (verify_jwt = true) and proves rep access through RLS,
// then reads the stored score summaries, explained learning moments, and playbook
// adherence for the rep's calls in the period, ranks them (report-input), asks
// Claude to write the note (report-contract), verifies every citation, and stores
// the result in coaching_reports. Synchronous: returns the finished report.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { buildUsageRows, callPAL } from "../_shared/pal/index.ts";
import {
  buildReportInput,
  type ReportAdherence,
  type ReportCall,
  type ReportMoment,
} from "../_shared/coaching/report-input.ts";
import {
  buildRepReportTool,
  buildReportSystemPrompt,
  normalizeRepReport,
  renderReportInput,
} from "../_shared/coaching/report-contract.ts";
import {
  buildCallStrip,
  buildSinceLast,
  renderSinceLast,
  type AdherenceRow,
  type GuidelineRef,
} from "../_shared/coaching/report-trend.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const num = (v: unknown, fallback = 0) => (v === null || v === undefined ? fallback : Number(v));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Reports are not configured" }, 503);

  const authorization = req.headers.get("Authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to generate reports" }, 401);

  const body = (await req.json().catch(() => null)) as {
    rep_id?: unknown;
    days?: unknown;
  } | null;
  const repId = typeof body?.rep_id === "string" ? body.rep_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(repId)) return json({ error: "rep_id is required" }, 400);
  const days = Math.min(365, Math.max(1, Math.round(num(body?.days, 30))));
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 86_400_000);
  const period = { start: isoDate(periodStart), end: isoDate(periodEnd) };

  // RLS on reps proves membership: a rep the user cannot read does not exist for them.
  const { data: rep } = await client
    .from("reps")
    .select("id, organization_id, name, playbook_id")
    .eq("id", repId)
    .maybeSingle();
  if (!rep) return json({ error: "Rep not found" }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // The previous completed report defines "last time": its period is the comparison
  // window and its drill is what we check first. Without one, compare against the
  // same-length window just before this period.
  const { data: previousReport } = await admin
    .from("coaching_reports")
    .select("id, period_start, period_end, drill_guideline_id")
    .eq("rep_id", repId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousWindow = {
    start: new Date(periodStart.getTime() - days * 86_400_000),
    end: periodStart,
  };
  const previousPeriod = { start: isoDate(previousWindow.start), end: isoDate(previousWindow.end) };

  const callsInWindow = async (start: Date, end: Date) => {
    const { data, error } = await admin
      .from("calls")
      .select("id")
      .eq("organization_id", rep.organization_id)
      .eq("rep_id", repId)
      .or(
        `and(started_at.gte.${start.toISOString()},started_at.lt.${end.toISOString()}),and(started_at.is.null,created_at.gte.${start.toISOString()},created_at.lt.${end.toISOString()})`,
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map((c) => c.id);
  };
  let periodCallIds: string[], previousPeriodCallIds: string[];
  try {
    [periodCallIds, previousPeriodCallIds] = await Promise.all([
      callsInWindow(periodStart, periodEnd),
      callsInWindow(previousWindow.start, previousWindow.end),
    ]);
  } catch {
    return json({ error: "Could not load calls in the requested period" }, 500);
  }
  // Re-scoring an older call must not move it into a new period.
  const { data: summaries, error: summariesError } = await admin
    .from("call_score_summaries")
    .select(
      "call_id, duration_seconds, coaching_value_label, quality_score, risk_count, peak_temperature, final_temperature, rep_move_average, computed_at, playbook_id, playbook_version_id",
    )
    .eq("rep_id", repId)
    .in("call_id", periodCallIds)
    .order("computed_at", { ascending: false })
    .limit(60);
  if (summariesError) return json({ error: summariesError.message }, 500);
  if (!summaries?.length)
    return json(
      {
        error: `No scored calls for this rep in the last ${days} days. Upload and score calls first.`,
      },
      409,
    );
  const callIds = summaries.map((s) => s.call_id as string);

  const [callsRes, momentsRes, timesRes, insightsRes, canonicalRes] = await Promise.all([
    admin.from("calls").select("id, started_at, created_at").in("id", callIds),
    admin
      .from("call_learning_moments")
      .select(
        "call_id, exchange_index, type, score, low_confidence, rep_text, customer_text, headline, why_it_matters, what_to_say_instead, playbook_guideline, guideline_source, guideline_id",
      )
      .in("call_id", callIds),
    admin
      .from("call_exchange_scores")
      .select("call_id, exchange_index, start_s")
      .in("call_id", callIds),
    admin
      .from("call_insights")
      .select("call_id, vertical_insights->playbook_adherence")
      .in("call_id", callIds),
    admin
      .from("call_guideline_adherence")
      .select("call_id, guideline_id, status, guideline:coaching_playbook_guidelines(title)")
      .in("call_id", callIds),
  ]);
  for (const r of [callsRes, momentsRes, timesRes, insightsRes, canonicalRes])
    if (r.error) return json({ error: r.error.message }, 500);

  const startedAt = new Map(
    (callsRes.data ?? []).map((c) => [c.id as string, (c.started_at ?? c.created_at) as string]),
  );
  const startS = new Map(
    (timesRes.data ?? []).map((t) => [`${t.call_id}#${t.exchange_index}`, num(t.start_s, 0)]),
  );

  const calls: ReportCall[] = summaries.map((s) => ({
    call_id: s.call_id,
    started_at: startedAt.get(s.call_id) ?? null,
    duration_seconds: s.duration_seconds ?? null,
    coaching_value_label: s.coaching_value_label,
    quality_score: num(s.quality_score),
    risk_count: num(s.risk_count),
    peak_temperature: num(s.peak_temperature),
    final_temperature: num(s.final_temperature),
    rep_move_average: s.rep_move_average === null ? null : num(s.rep_move_average),
  }));
  const moments: ReportMoment[] = (momentsRes.data ?? []).map((m) => ({
    call_id: m.call_id,
    exchange_index: m.exchange_index,
    type: m.type,
    score: num(m.score),
    low_confidence: Boolean(m.low_confidence),
    start_s: startS.get(`${m.call_id}#${m.exchange_index}`) ?? null,
    rep_text: m.rep_text,
    customer_text: m.customer_text,
    headline: m.headline,
    why_it_matters: m.why_it_matters,
    what_to_say_instead: m.what_to_say_instead,
    playbook_guideline: m.playbook_guideline,
    guideline_source: m.guideline_source,
    guideline_id: m.guideline_id ?? null,
  }));
  const adherence: ReportAdherence[] = [];
  // Calls judged against canonical guidelines carry ids; older calls fall back to insight text.
  const canonicalCalls = new Set<string>();
  for (const row of canonicalRes.data ?? []) {
    const title = (row.guideline as { title?: string } | null)?.title;
    if (!title) continue;
    canonicalCalls.add(row.call_id);
    adherence.push({
      call_id: row.call_id,
      guideline: title,
      status: row.status as ReportAdherence["status"],
      guideline_id: row.guideline_id,
    });
  }
  for (const row of insightsRes.data ?? []) {
    if (canonicalCalls.has(row.call_id)) continue;
    const items = (row as { playbook_adherence?: unknown }).playbook_adherence;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const a = item as Record<string, unknown>;
      if (typeof a.guideline !== "string" || typeof a.status !== "string") continue;
      adherence.push({
        call_id: row.call_id,
        guideline: a.guideline,
        status: a.status as ReportAdherence["status"],
      });
    }
  }
  // New evidence records include positive/general behaviors without a guideline ID.
  const { data: behaviorRuns, error: behaviorError } = await admin
    .from("coaching_analysis_runs")
    .select(
      "id,call_id,started_at,analysis,playbook_version_id,prompt_version,taxonomy_version,models",
    )
    .in("call_id", callIds)
    .order("started_at", { ascending: false });
  if (behaviorError)
    return json(
      { error: "Behavioral history is unavailable; apply the behavioral-data migration" },
      503,
    );
  const latestRuns = new Map<
    string,
    {
      id: string;
      analysis: import("../_shared/coaching/behavior-intelligence.ts").BehaviorAnalysis;
      prompt_version: string;
      taxonomy_version: string;
      models: string[];
    }
  >();
  for (const run of behaviorRuns ?? [])
    if (!latestRuns.has(run.call_id)) latestRuns.set(run.call_id, run);
  for (const [callId, run] of latestRuns)
    for (const e of run.analysis?.events ?? []) {
      const repEvidence = e.rep_evidence[0];
      if (!repEvidence) continue;
      moments.push({
        call_id: callId,
        exchange_index: -1 - repEvidence.turn_id,
        type: "behavior_observation",
        behavior_family: e.family,
        valence: e.result,
        score: e.result === "concern" ? 1 : 0.8,
        low_confidence: false,
        start_s: repEvidence.start_s,
        rep_text: e.rep_evidence.map((t) => t.text).join(" "),
        customer_text: e.buyer_evidence.map((t) => t.text).join(" ") || null,
        headline: e.rep_behavior,
        why_it_matters: e.interpretation,
        what_to_say_instead: e.coaching_action,
        playbook_guideline: null,
        guideline_source: "general",
      });
    }
  // Immutable run execution is authoritative; legacy adherence is only a projection.
  for (let i = adherence.length - 1; i >= 0; i--)
    if (latestRuns.has(adherence[i].call_id)) adherence.splice(i, 1);
  for (const [callId, run] of latestRuns)
    for (const item of run.analysis.execution?.items ?? [])
      adherence.push({
        call_id: callId,
        guideline: item.guideline,
        guideline_id: item.guideline_id ?? null,
        status: item.status as ReportAdherence["status"],
      });
  const input = buildReportInput({ calls, moments, adherence });

  // Canonical adherence rows for both windows, for the code-computed comparison.
  const toRows = (data: unknown[] | null): AdherenceRow[] =>
    (data ?? []).map((r) => {
      const row = r as { call_id: string; guideline_id: string; status: AdherenceRow["status"] };
      return { call_id: row.call_id, guideline_id: row.guideline_id, status: row.status };
    });
  const currentRows = toRows(
    adherence
      .filter((r) => r.guideline_id)
      .map((r) => ({ call_id: r.call_id, guideline_id: r.guideline_id, status: r.status })),
  );
  const { data: previousSummaries } = await admin
    .from("call_score_summaries")
    .select("call_id")
    .eq("rep_id", repId)
    .in("call_id", previousPeriodCallIds)
    .limit(60);
  const previousCallIds = (previousSummaries ?? []).map((s) => s.call_id as string);
  const { data: previousAdherence } = previousCallIds.length
    ? await admin
        .from("call_guideline_adherence")
        .select("call_id, guideline_id, status")
        .in("call_id", previousCallIds)
    : { data: [] as unknown[] };
  let previousRows = toRows(previousAdherence);
  const { data: priorRuns, error: priorRunError } = previousCallIds.length
    ? await admin
        .from("coaching_analysis_runs")
        .select("id,call_id,analysis,prompt_version,taxonomy_version,models,started_at")
        .in("call_id", previousCallIds)
        .order("started_at", { ascending: false })
    : { data: [], error: null };
  if (priorRunError) return json({ error: "Could not validate prior analysis versions" }, 503);
  const priorLatest = new Map<string, typeof latestRuns extends Map<string, infer R> ? R : never>();
  for (const run of priorRuns ?? [])
    if (!priorLatest.has(run.call_id)) priorLatest.set(run.call_id, run);
  previousRows = [...priorLatest].flatMap(([callId, run]) =>
    (run.analysis.execution?.items ?? []).flatMap((item) =>
      item.guideline_id
        ? [
            {
              call_id: callId,
              guideline_id: item.guideline_id,
              status: item.status as AdherenceRow["status"],
            },
          ]
        : [],
    ),
  );
  const configs = new Set(
    [...latestRuns.values(), ...priorLatest.values()].map((run) =>
      JSON.stringify([run.prompt_version, run.taxonomy_version, run.models]),
    ),
  );
  const comparableAnalysis =
    latestRuns.size === callIds.length &&
    previousCallIds.length > 0 &&
    priorLatest.size === previousCallIds.length &&
    configs.size === 1;

  // Playbook: the rep's explicit one, else the org's only active one (same rule as analyze-call).
  let playbook: {
    id: string;
    versionId: string;
    name: string;
    version: number;
    content: string;
  } | null = null;
  let playbookId: string | null = rep.playbook_id ?? null;
  if (!playbookId) {
    const { data: active } = await admin
      .from("coaching_playbooks")
      .select("id")
      .eq("organization_id", rep.organization_id)
      .eq("status", "active")
      .limit(2);
    if (active?.length === 1) playbookId = active[0].id;
  }
  if (playbookId) {
    const { data: head } = await admin
      .from("coaching_playbooks")
      .select("id, name, current_version_id")
      .eq("id", playbookId)
      .eq("status", "active")
      .maybeSingle();
    if (head?.current_version_id) {
      const { data: version } = await admin
        .from("coaching_playbook_versions")
        .select("id, version, content")
        .eq("id", head.current_version_id)
        .maybeSingle();
      if (version?.content)
        playbook = {
          id: head.id,
          versionId: version.id,
          name: head.name,
          version: version.version,
          content: version.content,
        };
    }
  }

  // The checklist for this playbook version: codes for the drill, titles for the trend lines.
  const guidelineRefs: GuidelineRef[] = [];
  if (playbook) {
    const { data: guidelineRows } = await admin
      .from("coaching_playbook_guidelines")
      .select("id, code, title")
      .eq("version_id", playbook.versionId)
      .order("position");
    for (const g of guidelineRows ?? [])
      guidelineRefs.push({ id: g.id, code: g.code, title: g.title });
  }
  const codes = guidelineRefs.map((g) => g.code);
  // A new/current playbook must not rewrite historical interpretation.
  const versions = new Set(summaries.map((s) => s.playbook_version_id).filter(Boolean));
  const comparableVersion = playbook && versions.size === 1 && versions.has(playbook.versionId);
  const comparableIds = new Set(
    comparableVersion && comparableAnalysis ? guidelineRefs.map((g) => g.id) : [],
  );
  const sinceLast = buildSinceLast({
    guidelines: guidelineRefs,
    current: currentRows.filter((r) => comparableIds.has(r.guideline_id)),
    previous: previousRows.filter((r) => comparableIds.has(r.guideline_id)),
    currentCalls: callIds.length,
    previousCalls: previousCallIds.length,
    previousPeriod: previousCallIds.length ? previousPeriod : null,
    drillGuidelineId: previousReport?.drill_guideline_id ?? null,
  });
  const strip = buildCallStrip(calls, currentRows, previousReport?.drill_guideline_id ?? null);

  const { data: row, error: insertError } = await admin
    .from("coaching_reports")
    .insert({
      organization_id: rep.organization_id,
      rep_id: rep.id,
      created_by: user.id,
      period_start: period.start,
      period_end: period.end,
      trigger: "manual",
      status: "running",
      call_ids: callIds,
      call_count: callIds.length,
      playbook_id: playbook?.id ?? null,
      playbook_version_id: playbook?.versionId ?? null,
      previous_report_id: previousReport?.id ?? null,
      input,
    })
    .select("id")
    .single();
  if (insertError || !row)
    return json({ error: insertError?.message ?? "Could not start report" }, 500);

  const fail = async (message: string, status: number) => {
    await admin
      .from("coaching_reports")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", row.id);
    return json({ error: message, report_id: row.id }, status);
  };

  let result;
  try {
    result = await callPAL(
      {
        systemPrompt: buildReportSystemPrompt(comparableVersion ? playbook : null),
        userPrompt: [
          "Write the coaching note for this rep from the material below. Cite only listed moments.",
          renderReportInput(input, { name: rep.name }, period),
          renderSinceLast(sinceLast),
          "Do not claim coaching caused improvement. Period comparisons are observational; call objectives, buyer constraints and analysis versions may differ. Ground a strength in source evidence when present.",
        ].join("\n\n"),
        tool: buildRepReportTool(codes),
        maxTokens: 2500,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Report generation failed", 502);
  }

  const report = normalizeRepReport(result.toolResult, input, codes);
  if (!report) return fail("The model returned no citable findings for this period", 502);
  report.since_last = sinceLast;
  report.strip = strip;
  const drillGuidelineId = report.drill.guideline_code
    ? (guidelineRefs.find((g) => g.code === report.drill.guideline_code)?.id ?? null)
    : null;

  const { error: updateError } = await admin
    .from("coaching_reports")
    .update({
      status: "completed",
      report,
      drill_guideline_id: drillGuidelineId,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.actualCostUsd,
      completed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (updateError) return fail(updateError.message, 500);

  const { creditRow, usageRow } = buildUsageRows(result, {
    userId: user.id,
    orgId: rep.organization_id,
    workspaceId: null,
    eventType: "coaching_report",
    resourceKey: "coaching-report",
  });
  await Promise.all([
    admin.from("credit_ledger").insert(creditRow),
    usageRow ? admin.from("usage_events").insert(usageRow) : Promise.resolve(),
  ]).catch((e) => console.error("[coaching-report] usage", e instanceof Error ? e.message : e));

  return json({ ok: true, report_id: row.id, report, call_count: callIds.length, period });
});
