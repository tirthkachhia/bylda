// analyze-call — turns a call transcript into structured conversation
// intelligence. Given a call_id (with a transcript already stored in
// call_transcripts by the carrier/transcription integration), it asks the model
// to extract objections, competitor mentions, talk ratio, sentiment and next
// steps, writes call_insights, backfills the transcript sentiment, and surfaces
// a coaching signal under Mo Latif. Provider-agnostic: it only needs the
// transcript text, so it works regardless of which carrier recorded the call.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callPAL } from "../_shared/pal/index.ts";
import { buildContextPackage, renderContextPackageForPrompt } from "../_shared/context-engine.ts";
import { emitDomainEvent, sha256Hex } from "../_shared/context-ingestion.ts";
import {
  buildVerticalExtractionTool,
  buildVerticalSystemPrompt,
  filterCrmContext,
  hydrateSalesVerticalProfile,
  normalizeCallExtraction,
  resolveSalesVertical,
} from "../_shared/sales-verticals.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const internalRequest = authHeader === `Bearer ${serviceKey}`;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const authResult = internalRequest ? null : await supabase.auth.getUser();
  const user = authResult?.data.user ?? null;
  if (!internalRequest && (authResult?.error || !user)) return json({ error: "Unauthorized" }, 401);

  let body: {
    call_id?: string;
    analysis_job_id?: string;
    analysis_attempt_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const callId = String(body.call_id ?? "");
  const analysisJobId = body.analysis_job_id ? String(body.analysis_job_id) : null;
  const analysisAttemptToken = body.analysis_attempt_token
    ? String(body.analysis_attempt_token)
    : null;
  if (!callId) return json({ error: "call_id is required" }, 400);
  if (Boolean(analysisJobId) !== Boolean(analysisAttemptToken)) {
    return json({ error: "analysis job and attempt token must be provided together" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Load the call + its org, and verify membership.
  const { data: call } = await admin
    .from("calls")
    .select("id, organization_id, contact_id, lead_id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return json({ error: "Call not found" }, 404);

  if (!internalRequest) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user!.id)
      .eq("organization_id", call.organization_id)
      .maybeSingle();
    if (!member) return json({ error: "Forbidden" }, 403);
  }
  const updateAnalysisJob = async (status: "failed" | "superseded", errorMessage: string) => {
    if (!analysisJobId || !analysisAttemptToken) return;
    await admin
      .from("call_analysis_jobs")
      .update({ status, error_message: errorMessage })
      .eq("id", analysisJobId)
      .eq("attempt_token", analysisAttemptToken);
  };
  let expectedTranscriptHash: string | null = null;
  if (analysisJobId && analysisAttemptToken) {
    const { data: acquired, error: acquireError } = await admin.rpc("acquire_call_analysis", {
      p_job_id: analysisJobId,
      p_attempt_token: analysisAttemptToken,
      p_organization_id: call.organization_id,
      p_call_id: callId,
    });
    if (acquireError) return json({ error: "Analysis job could not be acquired" }, 500);
    if (!acquired) return json({ ok: true, skipped: "analysis_job_not_acquired" });
    const { data: job } = await admin
      .from("call_analysis_jobs")
      .select("transcript_hash")
      .eq("id", analysisJobId)
      .eq("attempt_token", analysisAttemptToken)
      .maybeSingle();
    expectedTranscriptHash = job?.transcript_hash ? String(job.transcript_hash) : null;
    if (!expectedTranscriptHash) return json({ error: "Invalid analysis job" }, 400);
  }

  const { data: transcript } = await admin
    .from("call_transcripts")
    .select("id, transcript_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rawTranscriptText = transcript?.transcript_text ?? "";
  const text = rawTranscriptText.trim();
  if (!text) {
    await updateAnalysisJob("failed", "Transcript is missing");
    return json({ error: "No transcript to analyze for this call" }, 400);
  }
  if (expectedTranscriptHash && (await sha256Hex(rawTranscriptText)) !== expectedTranscriptHash) {
    await updateAnalysisJob("superseded", "Transcript changed before analysis started");
    return json({ ok: true, skipped: "transcript_superseded" });
  }

  // The Context Engine is the single source for business, entity, historical,
  // permission and evidence context. The current transcript remains a separate
  // primary evidence input so it cannot be confused with prior state. The CRM
  // intelligence profile hydrates the sales vertical so extraction follows the
  // org's interview answers instead of only the inferred industry.
  let contextPackage: Awaited<ReturnType<typeof buildContextPackage>>;
  try {
    contextPackage = await buildContextPackage(admin, {
      organizationId: call.organization_id,
      userId: user?.id ?? null,
      task: "conversation_intelligence",
      callId,
      tokenBudget: 6000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Context assembly failed";
    await updateAnalysisJob("failed", message);
    return json({ error: message }, 500);
  }
  const { data: customProfile } = await admin
    .from("crm_intelligence_profiles")
    .select("generated_profile")
    .eq("organization_id", call.organization_id)
    .eq("status", "active")
    .maybeSingle();
  const identity =
    contextPackage.business.profile.identity &&
    typeof contextPackage.business.profile.identity === "object"
      ? (contextPackage.business.profile.identity as Record<string, unknown>)
      : {};
  const inferredVertical = resolveSalesVertical(identity.industry, identity.niche);
  const vertical = hydrateSalesVerticalProfile(customProfile?.generated_profile, inferredVertical);
  if (contextPackage.deal) {
    contextPackage.deal.custom_fields = filterCrmContext(
      vertical,
      contextPackage.deal.custom_fields,
    );
  }
  for (const contextContact of contextPackage.contacts) {
    contextContact.custom_fields = filterCrmContext(vertical, contextContact.custom_fields);
  }
  const promptContext = renderContextPackageForPrompt(contextPackage);

  let extracted: Record<string, unknown> = {};
  try {
    const result = await callPAL(
      {
        systemPrompt: buildVerticalSystemPrompt(vertical),
        userPrompt: [
          `Analyze this ${vertical.label} sales call and record only supported insights.`,
          "Treat the CONTEXT PACKAGE as prior state, not as transcript evidence. A vertical field still needs a transcript quote.",
          `CONTEXT PACKAGE:\n${promptContext}`,
          `TRANSCRIPT:\n${text.slice(0, 24000)}`,
        ].join("\n\n"),
        tool: buildVerticalExtractionTool(vertical),
        maxTokens: 1600,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
    );
    extracted = result.toolResult ?? {};
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    await updateAnalysisJob("failed", message);
    return json({ error: message }, 502);
  }

  const normalized = normalizeCallExtraction(vertical, extracted);
  const objections = normalized.objections;
  const competitors = normalized.competitor_mentions;
  const nextSteps = normalized.next_steps_extracted;
  const talkRatio = normalized.talk_ratio;
  const sentiment = normalized.sentiment_score;
  const summary = normalized.summary || null;
  const mentorParts: string[] = [];
  if (objections.length) mentorParts.push(`Objections: ${objections.slice(0, 3).join("; ")}.`);
  if (competitors.length)
    mentorParts.push(`Competitors named: ${competitors.slice(0, 3).join(", ")}.`);
  if (nextSteps.length) mentorParts.push(`Agreed next: ${nextSteps[0]}.`);
  const mentorInsight =
    objections.length > 0 || competitors.length > 0
      ? {
          agent_id: "mo-latif",
          type: "signal",
          title: "Call intel: follow-up needed",
          detail: mentorParts.join(" "),
          priority: competitors.length ? "high" : "medium",
        }
      : null;

  const analysisTranscriptHash = expectedTranscriptHash ?? (await sha256Hex(rawTranscriptText));
  const { data: completed, error: completionError } = await admin.rpc("complete_call_analysis", {
    p_job_id: analysisJobId,
    p_attempt_token: analysisAttemptToken,
    p_organization_id: call.organization_id,
    p_call_id: callId,
    p_transcript_id: transcript.id,
    p_transcript_hash: analysisTranscriptHash,
    p_result: {
      objections,
      competitor_mentions: competitors,
      talk_ratio: talkRatio,
      next_steps_extracted: nextSteps,
      summary,
      sentiment_score: sentiment,
      sales_profile: vertical.key,
      vertical_insights: {
        profile_label: vertical.label,
        deal_insights: normalized.deal_insights,
        fields: normalized.fields,
        compliance_flags: normalized.compliance_flags,
      },
      crm_writeback_preview: normalized.crm_writeback_preview,
      missing_required_fields: normalized.missing_required_fields,
      analysis_version: 2,
      context_receipt: contextPackage.receipt,
      context_version: contextPackage.receipt.context_version,
      mentor_insight: mentorInsight,
    },
  });
  if (completionError) {
    await updateAnalysisJob("failed", completionError.message);
    return json({ error: "Call analysis could not be stored" }, 500);
  }
  if (!completed) {
    return json({ ok: true, skipped: "analysis_attempt_superseded" });
  }

  await emitDomainEvent(admin, {
    organizationId: call.organization_id,
    eventKey: `call:${callId}:analyzed:v2:${analysisJobId ?? "manual"}`,
    eventType: "conversation.analyzed",
    source: "analyze-call",
    subjectType: "call",
    subjectId: callId,
    payload: {
      analysis_version: 2,
      context_version: contextPackage.receipt.context_version,
      lead_id: call.lead_id,
      contact_id: call.contact_id,
      objections: objections.length,
      competitor_mentions: competitors.length,
      next_steps: nextSteps.length,
    },
  });
  return json({
    ok: true,
    call_id: callId,
    objections: objections.length,
    competitor_mentions: competitors.length,
    next_steps: nextSteps.length,
    talk_ratio: talkRatio,
    sentiment_score: sentiment,
    sales_profile: vertical.key,
    extracted_fields: normalized.fields.length,
    writeback_candidates: normalized.crm_writeback_preview.filter((field) => field.eligible).length,
    manual_review_fields: normalized.crm_writeback_preview.filter((field) => !field.eligible)
      .length,
    missing_required_fields: normalized.missing_required_fields,
    compliance_flags: normalized.compliance_flags,
  });
});
