export const ENDPOINT = "https://ipidfqwlszuhjgjygbvx.supabase.co/functions/v1/readymode-extension";
export const MAX_AUDIO = 100 * 1024 * 1024;
export function parseConnection(value) {
  let code;
  try {
    code = JSON.parse(value.trim());
  } catch {
    throw new Error("Paste the connection code from BYLDA Integrations.");
  }
  if (
    !code ||
    code.version !== 1 ||
    code.endpoint !== ENDPOINT ||
    typeof code.token !== "string" ||
    !/^[a-f0-9]{64}$/.test(code.token)
  )
    throw new Error("This is not a valid BYLDA connection code.");
  return {
    endpoint: ENDPOINT,
    token: code.token,
    workspace: String(code.workspace || "BYLDA workspace").slice(0, 120),
    rep_id: code.rep_id || undefined,
  };
}
export function allowedMediaUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/(^|\.)(readymode\.com|xencall\.com|amazonaws\.com|cloudfront\.net)$/i.test(url.hostname)
  )
    throw new Error(
      "Unsupported recording host. Download the recording and choose the file below.",
    );
  return url;
}
export function audioType(blob, url = "") {
  const types = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "application/ogg": "ogg",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
  };
  const mime = blob.type.split(";")[0];
  const fromName = url.match(/\.(mp3|mp4|m4a|wav|webm|ogg|flac)(?:$|[?#])/i)?.[1]?.toLowerCase();
  const ext = types[mime] || (mime === "application/octet-stream" || !mime ? fromName : undefined);
  if (!ext || !blob.size || blob.size > MAX_AUDIO)
    throw new Error(
      "Choose an audio recording up to 100 MB. The download may have returned a login page.",
    );
  return ext;
}
export function plainTranscript(value) {
  if (!value.includes("-->")) return value.trim();
  const lines = value.replace(/^WEBVTT[^\n]*\n?/i, "").split(/\r?\n/);
  return lines
    .filter(
      (line, index) =>
        !/-->/.test(line) && !(/^\s*\d+\s*$/.test(line) && /-->/.test(lines[index + 1] || "")),
    )
    .join("\n")
    .trim();
}
export async function importCall(
  connection,
  call,
  { file, transcript, request = fetch, onStage = () => {} } = {},
) {
  const api = async (action, extra = {}) => {
    const response = await request(connection.endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      headers: { "Content-Type": "application/json", "x-bylda-connection": connection.token },
      body: JSON.stringify({
        external_id: call.external_id,
        source_url: call.source_url,
        duration: call.duration,
        started_at: call.started_at,
        direction: call.direction,
        disposition: call.disposition,
        from_number: call.from_number,
        to_number: call.to_number,
        consent: true,
        action,
        rep_id: connection.rep_id,
        transcript: transcript ?? call.transcript,
        ...extra,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `BYLDA returned ${response.status}`);
    return result;
  };
  const hasTranscript = (transcript ?? call.transcript)?.trim();
  let audio = file;
  if (!audio && call.recording_url && (!hasTranscript || call.include_recording)) {
    onStage("Downloading recording…");
    const media = allowedMediaUrl(call.recording_url);
    const response = await request(media.href, { credentials: "include", redirect: "error" });
    if (!response.ok)
      throw new Error(
        "ReadyMode did not allow the recording download. Download it manually and attach the file.",
      );
    if (Number(response.headers.get("Content-Length")) > MAX_AUDIO)
      throw new Error("Recording exceeds 100 MB.");
    audio = await response.blob();
  }
  let extra = {};
  if (audio) {
    const extension = audioType(audio, file?.name || call.recording_url);
    extra = { extension, size: audio.size };
    onStage("Uploading private recording…");
    const prepared = await api("prepare", extra);
    if (!prepared.already_uploaded) {
      const upload = new URL(prepared.upload_url);
      if (
        upload.origin !== new URL(ENDPOINT).origin ||
        !upload.pathname.startsWith("/storage/v1/object/upload/sign/call-audio/")
      )
        throw new Error("Unexpected recording upload destination.");
      const response = await request(upload.href, {
        method: "PUT",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": prepared.content_type },
        body: audio,
      });
      if (!response.ok) throw new Error("Recording upload failed. Retry this call.");
    }
  }
  if (!audio && !hasTranscript)
    throw new Error("Attach a recording or transcript before importing.");
  onStage("Saving call and queuing analysis…");
  return api("import", extra);
}
