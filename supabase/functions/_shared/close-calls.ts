import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import type { StoredOAuth } from "./integration-credentials.ts";
import { resolveCallEntities, upsertExternalObject } from "./context-ingestion.ts";

type Row = Record<string, unknown>;
const obj = (value: unknown): Row => value && typeof value === "object" ? value as Row : {};
const str = (value: unknown) => typeof value === "string" ? value : "";

export function closeTranscript(call: Row) {
  // Notes and AI summaries are not transcripts. Request these fields explicitly.
  const recording = obj(call.recording_transcript);
  const voicemail = obj(call.voicemail_transcript);
  const source = Array.isArray(recording.utterances) && recording.utterances.length ? recording : voicemail;
  const segments = (Array.isArray(source.utterances) ? source.utterances : []).flatMap((value) => {
    const row = obj(value);
    const text = str(row.text).trim();
    if (!text) return [];
    return [{ text, speaker: str(row.speaker_label) || str(row.speaker_side) || "Unknown",
      speaker_side: str(row.speaker_side),
      ...(typeof row.start === "number" && Number.isFinite(row.start) && row.start >= 0 ? { start: row.start } : {}),
      ...(typeof row.end === "number" && Number.isFinite(row.end) && row.end >= 0 ? { end: row.end } : {}),
    }];
  });
  return { segments, text: segments.map((s) => `${s.speaker}: ${s.text}`).join("\n") };
}

async function transcribeCloseRecording(admin: SupabaseClient, input: { organizationId: string; oauth: StoredOAuth }, call: Row) {
  const worker = Deno.env.get("TRANSCRIPTION_WORKER_URL");
  const secret = Deno.env.get("CALL_TRANSCRIPTION_SECRET");
  if (!worker || !secret) throw new Error("transcription is not configured");
  let url = new URL(str(call.recording_url) || str(call.voicemail_url));
  // Never send Close credentials to a user-supplied external recording host.
  if (url.protocol !== "https:" || url.hostname !== "api.close.com" || url.port) throw new Error("external recording host needs manual import");
  let response: Response | undefined;
  for (let hop = 0; hop < 4; hop++) {
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000), headers: url.hostname === "api.close.com" ? { Authorization: `Bearer ${input.oauth.accessToken}` } : {} });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("recording redirect has no destination");
    url = new URL(location, url);
    if (url.protocol !== "https:" || url.port || !(url.hostname === "api.close.com" || url.hostname.endsWith(".amazonaws.com") || url.hostname.endsWith(".cloudfront.net"))) throw new Error("recording redirect host is not supported");
  }
  if (!response?.ok || !response.body) throw new Error(`recording download HTTP ${response?.status ?? 0}`);
  const limit = 25 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit) throw new Error("recording exceeds 25 MB");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error("recording exceeds 25 MB"); }
    parts.push(value);
  }
  if (!size) throw new Error("recording is empty");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  const path = `${input.organizationId}/close-import/${encodeURIComponent(str(call.id))}.mp3`;
  const { error: uploadError } = await admin.storage.from("call-audio").upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) throw new Error("could not store private recording");
  const { data: signed, error: signError } = await admin.storage.from("call-audio").createSignedUrl(path, 180);
  if (signError || !signed) throw new Error("could not sign private recording");
  const result = await fetch(worker, { method: "POST", signal: AbortSignal.timeout(60000), headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ recording_url: signed.signedUrl, provider: "close_io" }) });
  if (!result.ok) throw new Error(`transcription worker HTTP ${result.status}`);
  const payload = await result.json();
  if (typeof payload.transcript !== "string" || !payload.transcript.trim()) throw new Error("recording contained no recognized speech");
  return { text: payload.transcript.trim(), path };
}

export async function syncCloseCalls(admin: SupabaseClient, input: { organizationId: string; oauth: StoredOAuth }) {
  const result = { calls_received: 0, calls_imported: 0, transcripts_imported: 0, analyses_queued: 0, warning: null as string | null };
  let missing = 0;
  let hasMore = false;
  let fallbackAttempts = 0;
  const issues: string[] = [];
  // Bounded latest-call backfill; report the bound instead of claiming a full history sync.
  for (let page = 0; page < 5; page++) {
    const url = new URL("https://api.close.com/api/v1/activity/call/");
    url.searchParams.set("_limit", "100");
    url.searchParams.set("_skip", String(page * 100));
    url.searchParams.set("_order_by", "-date_created");
    url.searchParams.set("_fields", "id,contact_id,lead_id,direction,status,duration,disposition,remote_phone,local_phone,recording_url,voicemail_url,activity_at,date_created,date_updated,user_id,recording_transcript,voicemail_transcript");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${input.oauth.accessToken}` }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Close call sync returned HTTP ${response.status}. ${response.status === 401 ? "Reconnect Close." : "Check Close account access."}`);
    const payload = await response.json();
    const rows: Row[] = Array.isArray(payload.data) ? payload.data : [];
    result.calls_received += rows.length;
    for (const call of rows) {
      if (!str(call.id)) continue;
      const entities = await resolveCallEntities(admin, { organizationId: input.organizationId, provider: "close_io", externalContactId: str(call.contact_id), customerPhone: str(call.remote_phone) });
      const inbound = call.direction === "inbound";
      const transcript = closeTranscript(call);
      const { data: previous, error: previousError } = await admin.from("calls").select("metadata").eq("organization_id", input.organizationId).eq("provider", "close_io").eq("provider_call_id", call.id).maybeSingle();
      if (previousError) throw new Error("Could not check existing Close call");
      const { data: stored, error } = await admin.from("calls").upsert({
        organization_id: input.organizationId, contact_id: entities.contactId, lead_id: entities.leadId,
        provider: "close_io", provider_call_id: call.id, direction: inbound ? "inbound" : "outbound",
        status: call.status === "completed" ? "completed" : call.status === "in-progress" ? "in_progress" : "failed",
        duration: typeof call.duration === "number" && Number.isFinite(call.duration) ? Math.max(0, Math.round(call.duration)) : null,
        disposition: str(call.disposition) || null,
        from_number: str(inbound ? call.remote_phone : call.local_phone) || null,
        to_number: str(inbound ? call.local_phone : call.remote_phone) || null,
        recording_url: str(call.recording_url) || str(call.voicemail_url) || null,
        started_at: str(call.activity_at) || str(call.date_created) || null,
        metadata: { ...obj(previous?.metadata), ingestion: "close-call-sync", close_lead_id: call.lead_id, close_user_id: call.user_id, transcript_status: transcript.text ? "available" : obj(previous?.metadata).transcript_status ?? "not_available", synced_at: new Date().toISOString() },
      }, { onConflict: "organization_id,provider,provider_call_id" }).select("id").single();
      if (error || !stored) throw new Error(`Close call persistence failed: ${error?.message ?? "missing row"}`);
      result.calls_imported++;
      await upsertExternalObject(admin, { organizationId: input.organizationId, provider: "close_io", externalObjectType: "call", externalObjectId: String(call.id), canonicalType: "call", canonicalId: stored.id });
      const { data: existing, error: readError } = await admin.from("call_transcripts").select("transcript_text,speaker_segments").eq("call_id", stored.id).maybeSingle();
      if (readError) throw new Error("Could not check existing Close transcript");
      if (!transcript.text && existing?.transcript_text) {
        transcript.text = existing.transcript_text;
        transcript.segments = existing.speaker_segments ?? [];
      }
      if (!transcript.text && (call.recording_url || call.voicemail_url) && fallbackAttempts < 3) {
        fallbackAttempts++;
        try {
          const generated = await transcribeCloseRecording(admin, input, call);
          transcript.text = generated.text;
          const { error: metadataError } = await admin.from("calls").update({ metadata: { ingestion: "close-call-sync", close_lead_id: call.lead_id, transcript_status: "worker_transcribed", audio_path: generated.path } }).eq("id", stored.id);
          if (metadataError) throw new Error("could not save recording metadata");
        } catch (error) { issues.push(error instanceof Error ? error.message : "recording transcription failed"); }
      }
      if (!transcript.text) { missing++; continue; }
      const { error: transcriptError } = await admin.from("call_transcripts").upsert({ call_id: stored.id, organization_id: input.organizationId, transcript_text: transcript.text, speaker_segments: transcript.segments }, { onConflict: "call_id" });
      if (transcriptError) throw new Error(`Close transcript persistence failed: ${transcriptError.message}`);
      result.transcripts_imported++;
      const { data: insight, error: insightError } = await admin.from("call_insights").select("id").eq("call_id", stored.id).maybeSingle();
      if (insightError) throw new Error("Could not check Close call analysis");
      if (existing?.transcript_text !== transcript.text || !insight) {
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const task = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-call`, { method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ call_id: stored.id }) }).then((response) => { if (!response.ok) console.error("Close analysis failed", response.status); }).catch(() => console.error("Close analysis request failed"));
        const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } }).EdgeRuntime;
        if (runtime) runtime.waitUntil(task); else await task;
        result.analyses_queued++;
      }
    }
    hasMore = Boolean(payload.has_more);
    if (!hasMore || !rows.length) break;
  }
  result.warning = [!result.calls_received ? "Close returned no call activities for this account." : "", missing ? `${missing} calls still have no transcript. Up to 3 recordings are transcribed per sync; sync again for remaining calls.` : "", ...new Set(issues), hasMore ? "Only the latest 500 calls were checked; older history was not imported." : ""].filter(Boolean).join(" ") || null;
  return result;
}
