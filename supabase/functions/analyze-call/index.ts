// analyze-call — turns a call transcript into structured conversation
// intelligence. Given a call_id (with a transcript already stored in
// call_transcripts by the carrier/transcription integration), it asks the model
// to extract objections, competitor mentions, talk ratio, sentiment and next
// steps, writes call_insights, backfills the transcript sentiment, and surfaces
// a coaching signal under Mo Latif. Provider-agnostic: it only needs the
// transcript text, so it works regardless of which carrier recorded the call.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callPAL } from "../_shared/pal/index.ts";

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

const EXTRACT_TOOL = {
  name: "record_call_insights",
  description: "Record structured coaching insights extracted from a sales call transcript.",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-3 sentence summary of the call." },
      sentiment_score: {
        type: "number",
        description: "Overall prospect sentiment from -1 (negative) to 1 (positive).",
      },
      talk_ratio: {
        type: "number",
        description: "Fraction of talk time by the rep, 0-1 (e.g. 0.6 = rep talked 60%).",
      },
      objections: {
        type: "array",
        items: { type: "string" },
        description: "Distinct objections or concerns the prospect raised.",
      },
      competitor_mentions: {
        type: "array",
        items: { type: "string" },
        description: "Competitor names or products referenced.",
      },
      next_steps_extracted: {
        type: "array",
        items: { type: "string" },
        description: "Concrete agreed next steps / follow-ups.",
      },
    },
    required: ["summary", "objections", "competitor_mentions", "next_steps_extracted"],
  },
};

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

  let body: { call_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const callId = String(body.call_id ?? "");
  if (!callId) return json({ error: "call_id is required" }, 400);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server not configured" }, 503);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Load the call + its org, and verify membership.
  const { data: call } = await admin
    .from("calls")
    .select("id, organization_id, contact_id, lead_id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return json({ error: "Call not found" }, 404);

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", call.organization_id)
    .maybeSingle();
  if (!member) return json({ error: "Forbidden" }, 403);

  const { data: transcript } = await admin
    .from("call_transcripts")
    .select("id, transcript_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const text = transcript?.transcript_text?.trim();
  if (!text) return json({ error: "No transcript to analyze for this call" }, 400);

  let extracted: Record<string, unknown> = {};
  try {
    const result = await callPAL(
      {
        systemPrompt:
          "You are a sales conversation-intelligence analyst. Extract only what the transcript supports; do not invent objections, competitors, or next steps. Be concise.",
        userPrompt: `Analyze this sales call transcript and record the insights.\n\nTRANSCRIPT:\n${text.slice(0, 24000)}`,
        tool: EXTRACT_TOOL,
        maxTokens: 900,
      },
      { ANTHROPIC_API_KEY: Deno.env.get("ANTHROPIC_API_KEY") },
    );
    extracted = result.toolResult ?? {};
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Analysis failed" }, 502);
  }

  const objections = Array.isArray(extracted.objections) ? extracted.objections : [];
  const competitors = Array.isArray(extracted.competitor_mentions)
    ? extracted.competitor_mentions
    : [];
  const nextSteps = Array.isArray(extracted.next_steps_extracted)
    ? extracted.next_steps_extracted
    : [];
  const talkRatio = typeof extracted.talk_ratio === "number" ? extracted.talk_ratio : null;
  const sentiment =
    typeof extracted.sentiment_score === "number" ? extracted.sentiment_score : null;
  const summary = typeof extracted.summary === "string" ? extracted.summary : null;

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
  });
});
