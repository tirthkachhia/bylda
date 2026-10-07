import { createClient } from "npm:@supabase/supabase-js@2.45.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Sign in to import calls" }, 401);
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.organization_id !== "string" ||
    typeof body.import_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.import_id)
  )
    return json({ error: "Invalid import" }, 400);
  const { data: member } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", body.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return json({ error: "Workspace access required" }, 403);
  const transcriptInput = typeof body.transcript === "string" ? body.transcript.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const audioPath = typeof body.audio_path === "string" ? body.audio_path : "";
  if (
    transcriptInput.length > 100000 ||
    details.length > 8000 ||
    (!audioPath && !transcriptInput) ||
    body.consent !== true
  )
    return json(
      {
        error:
          "Provide audio or a transcript and confirm permission. Transcript limit: 100,000 characters; details: 8,000.",
      },
      400,
    );
  if (
    audioPath &&
    (!audioPath.startsWith(`${body.organization_id}/${user.id}/${body.import_id}.`) ||
      audioPath.includes(".."))
  )
    return json({ error: "Invalid audio path" }, 400);
  // Use the authenticated client for all storage/database operations: RLS remains enforced.
  let transcript = transcriptInput;
  let transcriptionStatus = transcript ? "supplied" : "not_configured";
  if (audioPath) {
    const { data: signed, error } = await client.storage
      .from("call-audio")
      .createSignedUrl(audioPath, 180);
    if (error || !signed)
      return json({ error: "Audio upload was not found or is inaccessible" }, 400);
    const worker = Deno.env.get("TRANSCRIPTION_WORKER_URL");
    const secret = Deno.env.get("CALL_TRANSCRIPTION_SECRET");
    if (!transcript && worker && secret) {
      try {
        const response = await fetch(worker, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            recording_url: signed.signedUrl,
            provider: "manual_upload",
            language: "en",
          }),
          signal: AbortSignal.timeout(90000),
        });
        transcriptionStatus = `worker_http_${response.status}`;
        const result = await response.json();
        if (!response.ok || typeof result.transcript !== "string" || !result.transcript.trim())
          throw new Error("Transcription failed");
        transcript = result.transcript.trim().slice(0, 100000);
        transcriptionStatus = "completed";
      } catch {
        if (!transcriptionStatus.startsWith("worker_http_")) transcriptionStatus = "failed";
      }
    }
  }
  const callId = body.import_id;
  // Retries use a stable import id, scoped to its creator and workspace.
  const { data: existing } = await client
    .from("calls")
    .select("id,user_id,organization_id,metadata")
    .eq("id", callId)
    .maybeSingle();
  if (
    existing &&
    (existing.user_id !== user.id || existing.organization_id !== body.organization_id)
  )
    return json({ error: "Import ID already in use" }, 409);
  if (existing) {
    const { data: saved, error: readError } = await client
      .from("call_transcripts")
      .select("id")
      .eq("call_id", callId)
      .limit(1)
      .maybeSingle();
    if (readError) return json({ error: "Could not check saved transcript" }, 500);
    if (!saved && transcript) {
      const { error } = await client
        .from("call_transcripts")
        .insert({
          call_id: callId,
          organization_id: body.organization_id,
          transcript_text: transcript,
          speaker_segments: [],
        });
      if (error) return json({ error: "Could not save transcript. Retry." }, 500);
    }
    if (transcript) {
      const { error } = await client.from("calls").update({ metadata: {
        ...existing.metadata, transcription_status: transcriptionStatus,
      } }).eq("id", callId).eq("user_id", user.id);
      if (error) return json({ error: "Transcript saved, but import status could not be updated. Retry." }, 500);
    }
    return json({
      call_id: callId,
      already_imported: true,
      transcript_available: !!saved || !!transcript,
      transcription_status: transcriptionStatus,
    });
  }
  const { error: callError } = await client.from("calls").insert({
    id: callId,
    organization_id: body.organization_id,
    user_id: user.id,
    provider: "manual_upload",
    provider_call_id: callId,
    status: "completed",
    direction: "outbound",
    metadata: {
      audio_path: audioPath || null,
      supplied_details: details,
      transcription_status: transcriptionStatus,
      permission_confirmed_at: new Date().toISOString(),
    },
  });
  if (callError) return json({ error: "Could not save call; your audio remains uploaded" }, 500);
  if (transcript) {
    const { error } = await client.from("call_transcripts").insert({
      call_id: callId,
      organization_id: body.organization_id,
      transcript_text: transcript,
      speaker_segments: [],
    });
    if (error) {
      await client.from("calls").delete().eq("id", callId).eq("user_id", user.id);
      return json({ error: "Transcript could not be saved. Retry this import." }, 500);
    }
  }
  return json({
    call_id: callId,
    transcript_available: !!transcript,
    transcription_status: transcriptionStatus,
  });
});
