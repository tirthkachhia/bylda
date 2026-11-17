import type { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { importCall } from "./import-call.ts";
import {
  readyModeImportId,
  tokenHash,
  validateReadyModeAudio,
  validateReadyModeImport,
} from "./readymode-extension.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-bylda-connection",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
async function storedAudio(admin: SupabaseClient, audioPath: string) {
  const slash = audioPath.lastIndexOf("/");
  const filename = audioPath.slice(slash + 1);
  const result = await admin.storage
    .from("call-audio")
    .list(audioPath.slice(0, slash), { search: filename, limit: 100 });
  return {
    data: result.data?.find((item) => item.name === filename && !!item.id),
    error: result.error,
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function handleReadyModeExtension(
  req: Request,
  clientFactory: typeof createClient,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // Recordings go directly to private storage; this endpoint only accepts bounded JSON.
  const text = await req.text();
  if (text.length > 150000) return json({ error: "Import request is too large" }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Expected JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "Expected JSON object" }, 400);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = clientFactory(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("x-bylda-connection");
  let orgId: string, userId: string;
  if (token) {
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid connection" }, 401);
    const { data, error } = await admin
      .from("readymode_extension_connections")
      .select("organization_id,user_id,expires_at")
      .eq("token_hash", await tokenHash(token))
      .maybeSingle();
    if (error) return json({ error: "Connection lookup failed" }, 503);
    if (!data || Date.parse(data.expires_at) <= Date.now())
      return json(
        { error: "Connection expired or revoked. Reconnect in Bylda Integrations." },
        401,
      );
    orgId = data.organization_id;
    userId = data.user_id;
    if (!["prepare", "import"].includes(String(body.action)))
      return json({ error: "Import-only connection" }, 403);
  } else {
    const client = clientFactory(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return json({ error: "Sign in to connect the extension" }, 401);
    if (typeof body.organization_id !== "string") return json({ error: "Choose a workspace" }, 400);
    orgId = body.organization_id;
    userId = user.id;
  }
  // Tokens stop working immediately when their owner loses workspace access.
  const { data: member, error: memberError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) return json({ error: "Membership lookup failed" }, 503);
  if (!member) return json({ error: "Workspace access required" }, 403);
  if (!token) {
    if (body.action === "disconnect") {
      const { error } = await admin
        .from("readymode_extension_connections")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", userId);
      return error ? json({ error: "Could not disconnect" }, 500) : json({ connected: false });
    }
    if (body.action === "status") {
      const { data, error } = await admin
        .from("readymode_extension_connections")
        .select("expires_at")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      return error
        ? json({ error: "Could not read connection" }, 500)
        : json({
            connected: !!data && Date.parse(data.expires_at) > Date.now(),
            expires_at: data?.expires_at,
          });
    }
    if (body.action !== "connect") return json({ error: "Unknown action" }, 400);
    const nextToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error } = await admin.from("readymode_extension_connections").upsert({
      organization_id: orgId,
      user_id: userId,
      token_hash: await tokenHash(nextToken),
      expires_at: expiresAt,
    });
    if (error) return json({ error: "Could not create connection" }, 500);
    return json({
      connected: true,
      expires_at: expiresAt,
      connection_code: JSON.stringify({
        version: 1,
        endpoint: `${url}/functions/v1/readymode-extension`,
        token: nextToken,
        rep_id: typeof body.rep_id === "string" ? body.rep_id : undefined,
        workspace:
          typeof body.workspace === "string" ? body.workspace.slice(0, 120) : "Bylda workspace",
      }),
    });
  }
  try {
    const input = validateReadyModeImport(body);
    const importId = await readyModeImportId(orgId, input.host, input.id);
    // Check ownership before minting an upload URL or writing any storage object.
    const { data: existing, error: existingError } = await admin
      .from("calls")
      .select("user_id,organization_id")
      .eq("id", importId)
      .maybeSingle();
    if (existingError) return json({ error: "Could not check existing import" }, 500);
    if (existing && (existing.user_id !== userId || existing.organization_id !== orgId))
      return json({ error: "This call was already imported by another workspace member." }, 409);
    const audioPath =
      typeof body.extension === "string"
        ? `${orgId}/${userId}/${importId}.${body.extension.toLowerCase()}`
        : "";
    if (body.action === "prepare") {
      const audio = validateReadyModeAudio(body);
      // Existing objects are immutable. Retry import/queue delivery without replacing audio.
      const { data: found } = await storedAudio(admin, audioPath);
      if (found)
        return json({ import_id: importId, audio_path: audioPath, already_uploaded: true });
      const { data, error } = await admin.storage
        .from("call-audio")
        .createSignedUploadUrl(audioPath);
      if (error || !data) return json({ error: "Could not prepare private recording upload" }, 500);
      return json({
        import_id: importId,
        audio_path: audioPath,
        upload_url: data.signedUrl,
        content_type: audio.contentType,
      });
    }
    if (body.extension !== undefined) {
      const audio = validateReadyModeAudio(body);
      const { data: info, error } = await storedAudio(admin, audioPath);
      const size = info?.metadata?.size;
      if (
        error ||
        !info ||
        typeof size !== "number" ||
        size !== body.size ||
        size > 100 * 1024 * 1024
      )
        return json({ error: "Recording upload is missing or incomplete. Retry the upload." }, 400);
      if (!audio.contentType) return json({ error: "Unsupported recording" }, 400);
    }
    if (!input.transcript && !audioPath)
      return json({ error: "Provide a transcript or recording" }, 400);
    // Never report recordings as queued if transcription is unavailable.
    const workerUrl = Deno.env.get("COACHING_WORKER_URL");
    const workerSecret = Deno.env.get("COACHING_WORKER_SECRET");
    if (!input.transcript && (!workerUrl || !workerSecret))
      return json(
        {
          error:
            "Recording transcription is not configured. Import an available transcript instead.",
        },
        503,
      );
    const result = await importCall(
      admin,
      { id: userId },
      {
        organization_id: orgId,
        import_id: importId,
        consent: true,
        transcript: input.transcript,
        audio_path: audioPath,
        rep_id: body.rep_id,
        details: `Imported from ReadyMode (${input.host}).`,
      },
      input.source,
    );
    const payload = await result.json();
    if (!result.ok) return json(payload, result.status);
    if (payload.transcript_available) {
      if (!workerUrl || !workerSecret)
        return json({
          ...payload,
          analysis_queued: false,
          warning: "Transcript saved. Analysis worker is not configured.",
        });
      const response = await fetch(`${workerUrl.replace(/\/$/, "")}/enqueue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${workerSecret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ kind: "analyze", call_id: importId, organization_id: orgId, user_id: userId }],
        }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!response?.ok)
        return json(
          { error: "Transcript saved, but analysis could not be queued. Retry this import." },
          502,
        );
      return json({ ...payload, analysis_queued: true });
    }
    return json(payload);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Import failed" }, 400);
  }
}
