export type NormalizedCall = {
  provider: string;
  providerCallId: string;
  direction: "inbound" | "outbound";
  duration: number | null;
  connected: boolean;
  disposition?: string;
  fromNumber?: string;
  toNumber?: string;
  recordingUrl?: string;
  transcript?: string;
  speakerSegments: unknown[];
  startedAt?: string;
  contactId?: string;
  leadId?: string;
  externalContactId?: string;
  externalLeadId?: string;
};

function first(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function uuid(value: string | undefined) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}

export function normalizeCall(raw: Record<string, unknown>): NormalizedCall {
  const nested = [raw.data, raw.call, raw.payload, raw.event, raw.body].find(
    (value) => value && typeof value === "object" && !Array.isArray(value),
  ) as Record<string, unknown> | undefined;
  const source = { ...raw, ...(nested ?? {}) };
  const transcriptObject = first(source, ["transcription", "transcript_data"]);
  const transcriptNested =
    transcriptObject && typeof transcriptObject === "object"
      ? (transcriptObject as Record<string, unknown>)
      : undefined;
  const transcript =
    text(first(source, ["transcript", "transcript_text", "transcription_text", "text"])) ??
    text(transcriptNested?.text);
  const segments = first(source, ["speaker_segments", "segments", "utterances"]);
  const duration = number(
    first(source, [
      "duration_seconds",
      "duration_sec",
      "duration",
      "call_duration",
      "talk_time",
      "talkTime",
      "length",
    ]),
  );
  const disposition = text(
    first(source, [
      "disposition",
      "outcome",
      "call_outcome",
      "call_result",
      "result_name",
      "result",
      "status",
    ]),
  );
  const statusValue = (disposition ?? "completed").toLowerCase();
  const connectedFlag = first(source, ["connected", "answered", "is_connected", "isAnswered"]);
  const connected =
    typeof connectedFlag === "boolean"
      ? connectedFlag
      : !["missed", "no_answer", "no-answer", "voicemail", "failed", "busy"].includes(statusValue);
  const provider =
    text(first(source, ["provider", "dialer", "source", "integration"])) ??
    text(raw.provider) ??
    "generic";
  const rawContactId = text(first(source, ["contact_id", "contactId", "external_contact_id"]));
  const rawLeadId = text(
    first(source, ["lead_id", "leadId", "opportunity_id", "external_opportunity_id"]),
  );

  return {
    provider: provider
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .slice(0, 64),
    providerCallId:
      text(
        first(source, [
          "provider_call_id",
          "call_log_id",
          "callLogId",
          "call_id",
          "callId",
          "recording_id",
          "id",
          "uuid",
          "sid",
        ]),
      ) ?? crypto.randomUUID(),
    direction:
      text(first(source, ["direction", "call_direction", "type"]))?.toLowerCase() === "inbound"
        ? "inbound"
        : "outbound",
    duration: duration == null ? null : Math.max(0, Math.round(duration)),
    connected,
    disposition,
    fromNumber: text(
      first(source, ["from_number", "phone_from", "from", "caller", "caller_number"]),
    ),
    toNumber: text(
      first(source, [
        "to_number",
        "phone_to",
        "to",
        "callee",
        "destination",
        "lead_phone",
        "phone_number",
      ]),
    ),
    recordingUrl: text(
      first(source, [
        "recording_url",
        "recordingUrl",
        "recording_link",
        "recording_mp3",
        "mp3_url",
        "recording",
        "audio_url",
      ]),
    ),
    transcript,
    speakerSegments: Array.isArray(segments) ? segments : [],
    startedAt: text(
      first(source, [
        "started_at",
        "start_time",
        "startTime",
        "call_date",
        "date_created",
        "timestamp",
      ]),
    ),
    contactId: uuid(rawContactId),
    leadId: uuid(rawLeadId),
    externalContactId: rawContactId && !uuid(rawContactId) ? rawContactId : undefined,
    externalLeadId: rawLeadId && !uuid(rawLeadId) ? rawLeadId : undefined,
  };
}
