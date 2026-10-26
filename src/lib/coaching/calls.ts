/** Insight row for one call, as read by the coaching page. */
export type CallInsight = {
  id: string;
  summary: string | null;
  sales_profile: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vertical_insights: Record<string, any> | null;
};

/** A call row hydrated with its contact, deal, transcript, and insight. */
export type CoachingCall = {
  id: string;
  rep_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  provider: string | null;
  direction: string;
  status: string;
  duration: number | null;
  disposition: string | null;
  started_at: string | null;
  created_at: string;
  /** From calls.metadata.coaching_stage: queued | transcribing | transcribed | failed, or null. */
  coaching_stage: string | null;
  coaching_error: string | null;
  /** From calls.metadata.audio_path: the recording in the call-audio bucket, if uploaded. */
  audio_path: string | null;
  contactName: string;
  company: string;
  dealName: string | null;
  transcript: string | null;
  segments: unknown[];
  insight: CallInsight | null;
};

export type TranscriptLine = {
  key: string;
  time: string;
  speaker: string;
  text: string;
  /** Present only for Gemini-transcribed calls. */
  tone?: { label: string; note: string };
  overlap?: boolean;
};

export function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatWhen(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Speaker segments as display lines; falls back to the raw transcript as one line. */
export function segmentLines(call: Pick<CoachingCall, "id" | "segments" | "transcript">) {
  const parsed = call.segments
    .map((raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const text = String(item.transcript ?? item.text ?? "").trim();
      if (!text) return null;
      const seconds = Number(item.startTime ?? item.start_time ?? item.start ?? NaN);
      const channel = String(item.speaker ?? item.mediaChannel ?? item.channel ?? "Call");
      const toneRaw = item.tone as { label?: unknown; note?: unknown } | undefined;
      const tone =
        toneRaw && typeof toneRaw.label === "string"
          ? { label: toneRaw.label, note: typeof toneRaw.note === "string" ? toneRaw.note : "" }
          : undefined;
      const line: TranscriptLine = {
        key: `${index}-${seconds}`,
        time: formatDuration(Number.isFinite(seconds) ? Math.round(seconds) : null),
        speaker: channel === "1" ? "Agent" : channel === "2" ? "Contact" : channel,
        text,
      };
      if (tone) line.tone = tone;
      if (item.overlap === true) line.overlap = true;
      return line;
    })
    .filter(Boolean) as TranscriptLine[];
  return parsed.length
    ? parsed
    : call.transcript
      ? [{ key: call.id, time: "—", speaker: "Call", text: call.transcript }]
      : [];
}
