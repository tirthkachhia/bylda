const MAX_AUDIO = 100 * 1024 * 1024;
export const recordingTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  m4a: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  flac: "audio/flac",
};
export function readyModeHost(value: unknown) {
  if (typeof value !== "string") throw new Error("Open a ReadyMode call page first.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/(^|\.)(readymode|xencall)\.com$/i.test(url.hostname)
  )
    throw new Error("Only HTTPS ReadyMode and Xencall pages are supported.");
  return url.hostname.toLowerCase();
}
export function validateReadyModeImport(body: Record<string, unknown>) {
  const host = readyModeHost(body.source_url);
  const id = typeof body.external_id === "string" ? body.external_id.trim() : "";
  if (!id || id.length > 512) throw new Error("A stable ReadyMode call ID is required.");
  if (body.consent !== true) throw new Error("Confirm permission to import these calls.");
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (transcript.length > 100000) throw new Error("Transcript exceeds 100,000 characters.");
  const duration = body.duration == null ? null : Number(body.duration);
  if (duration != null && (!Number.isFinite(duration) || duration < 0 || duration > 86400))
    throw new Error("Invalid call duration.");
  const field = (name: string, limit = 256) =>
    typeof body[name] === "string" ? (body[name] as string).trim().slice(0, limit) || null : null;
  const started = field("started_at");
  if (started && !Number.isFinite(Date.parse(started))) throw new Error("Invalid call time.");
  return {
    host,
    id,
    transcript,
    source: {
      provider: "readymode" as const,
      providerCallId: `${host}:${id}`,
      host,
      direction: body.direction === "inbound" ? ("inbound" as const) : ("outbound" as const),
      duration: duration == null ? null : Math.round(duration),
      startedAt: started ? new Date(started).toISOString() : null,
      disposition: field("disposition"),
      fromNumber: field("from_number", 64),
      toNumber: field("to_number", 64),
    },
  };
}
export function validateReadyModeAudio(body: Record<string, unknown>) {
  const extension = typeof body.extension === "string" ? body.extension.toLowerCase() : "";
  if (
    !recordingTypes[extension] ||
    typeof body.size !== "number" ||
    body.size <= 0 ||
    body.size > MAX_AUDIO
  )
    throw new Error("Choose a supported recording up to 100 MB.");
  return { extension, contentType: recordingTypes[extension] };
}
export async function tokenHash(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function readyModeImportId(org: string, host: string, id: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([org, host, id])),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 128; // UUID v8: application-defined deterministic identity.
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
