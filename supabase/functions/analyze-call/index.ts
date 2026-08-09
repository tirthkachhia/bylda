// analyze-call — turns a call transcript into structured conversation
// intelligence. Given a call_id (with a transcript already stored in
// call_transcripts by the carrier/transcription integration), it asks the model
// to extract objections, competitor mentions, talk ratio, sentiment and next
// steps, writes call_insights, backfills the transcript sentiment, and surfaces
// a coaching signal under Mo Latif. Provider-agnostic: it only needs the
// transcript text, so it works regardless of which carrier recorded the call.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callPAL } from "../_shared/pal/index.ts";
import {
  buildVerticalExtractionTool,
  buildVerticalSystemPrompt,
  filterCrmContext,
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

  let body: { call_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const callId = String(body.call_id ?? "");
  if (!callId) return json({ error: "call_id is required" }, 400);

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

  const { data: transcript } = await admin
    .from("call_transcripts")
    .select("id, transcript_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const text = transcript?.transcript_text?.trim();
  if (!text) return json({ error: "No transcript to analyze for this call" }, 400);

  // Workspace context selects the sales vertical. Existing CRM values are used
  // as prior context so the model reports changes instead of treating every call
  // as a blank record. Arbitrary custom fields are filtered to the profile's
  // allow-list before they are sent to the model.
  const [{ data: businessContext }, { data: lead }, { data: contact }] = await Promise.all([
    admin
      .from("business_context")
      .select("identity,customer,motion")
      .eq("organization_id", call.organization_id)
      .maybeSingle(),
    call.lead_id
      ? admin
          .from("leads")
          .select("name,stage,value,notes,custom_fields,external_source,external_id")
          .eq("id", call.lead_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    call.contact_id
      ? admin
          .from("contacts")
          .select("first_name,last_name,company,status,custom_fields,external_source,external_id")
          .eq("id", call.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const identity =
    businessContext?.identity && typeof businessContext.identity === "object"
      ? (businessContext.identity as Record<string, unknown>)
      : {};
  const vertical = resolveSalesVertical(identity.industry, identity.niche);
  const leadRecord = lead as Record<string, unknown> | null;
  const contactRecord = contact as Record<string, unknown> | null;
  const crmContext = {
    lead: leadRecord
      ? {
          name: leadRecord.name,
          stage: leadRecord.stage,
          value: leadRecord.value,
          notes: leadRecord.notes,
          source: leadRecord.external_source,
          custom_fields: filterCrmContext(vertical, leadRecord.custom_fields),
        }
      : null,
    contact: contactRecord
      ? {
          name: [contactRecord.first_name, contactRecord.last_name].filter(Boolean).join(" "),
          company: contactRecord.company,
          status: contactRecord.status,
          source: contactRecord.external_source,
          custom_fields: filterCrmContext(vertical, contactRecord.custom_fields),
        }
      : null,
  };

  let extracted: Record<string, unknown> = {};
  try {
    const result = await callPAL(
      {
        systemPrompt: buildVerticalSystemPrompt(vertical),
        userPrompt: [
          `Analyze this ${vertical.label} sales call and record only supported insights.`,
          "Treat CRM CONTEXT as prior state, not as transcript evidence. A vertical field still needs a transcript quote.",
          `CRM CONTEXT:\n${JSON.stringify(crmContext)}`,
          `TRANSCRIPT:\n${text.slice(0, 24000)}`,
        ].join("\n\n"),
        tool: buildVerticalExtractionTool(vertical),
        maxTokens: 1600,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
    );
    extracted = result.toolResult ?? {};
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Analysis failed" }, 502);
  }

  const normalized = normalizeCallExtraction(vertical, extracted);
  const objections = normalized.objections;
  const competitors = normalized.competitor_mentions;
  const nextSteps = normalized.next_steps_extracted;
  const talkRatio = normalized.talk_ratio;
  const sentiment = normalized.sentiment_score;
  const summary = normalized.summary || null;

  // Upsert insights (one row per call).
  await admin
    .from("call_insights")
    .upsert(
      {
        call_id: callId,
        organization_id: call.organization_id,
        objections,
        competitor_mentions: competitors,
        talk_ratio: talkRatio,
        next_steps_extracted: nextSteps,
        summary,
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
        writeback_status: "pending_review",
        approved_at: null,
        approved_by: null,
      },
      { onConflict: "call_id" },
    )
    .then(
      () => {},
      () => {},
    );

  if (sentiment != null && transcript?.id) {
    await admin
      .from("call_transcripts")
      .update({ sentiment_score: sentiment })
      .eq("id", transcript.id);
  }

  // Surface a coaching signal when the call flagged risk (objections/competitors).
  if (objections.length > 0 || competitors.length > 0) {
    const parts: string[] = [];
    if (objections.length) parts.push(`Objections: ${objections.slice(0, 3).join("; ")}.`);
    if (competitors.length) parts.push(`Competitors named: ${competitors.slice(0, 3).join(", ")}.`);
    if (nextSteps.length) parts.push(`Agreed next: ${nextSteps[0]}.`);
    await admin
      .from("mentor_insights")
      .insert({
        org_id: call.organization_id,
        agent_id: "mo-latif",
        type: "signal",
        title: "Call intel: follow-up needed",
        detail: parts.join(" "),
        priority: competitors.length ? "high" : "medium",
      })
      .then(
        () => {},
        () => {},
      );
  }

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
