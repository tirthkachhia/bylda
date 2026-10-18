// Validates Gemini's structured transcript before anything is stored.
// Pure module: no Deno or npm imports.
import {
  AUDIO_QUALITIES,
  SPEAKERS,
  TONE_LABELS,
  TRANSCRIPT_SCHEMA_VERSION,
  type StructuredTranscript,
  type StructuredTurn,
} from "./transcript-schema.ts";

export const MAX_TONE_NOTE_CHARS = 160;

export type ParsedTurn = StructuredTurn & { index: number; start_s: number; end_s: number };

export type ParsedTranscript = Omit<StructuredTranscript, "turns"> & { turns: ParsedTurn[] };

export type ValidationResult =
  { ok: true; transcript: ParsedTranscript } | { ok: false; reason: string };

/** "MM:SS" or "H:MM:SS" to seconds; null for anything else. */
export function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const numbers = parts.map((part) => (/^\d+(\.\d+)?$/.test(part) ? Number(part) : NaN));
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  return numbers.length === 2
    ? numbers[0] * 60 + numbers[1]
    : numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
}

function isOneOf<T extends readonly string[]>(list: T, value: unknown): value is T[number] {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Drops unusable turns, normalises timestamps, sorts, and rejects transcripts
 * that cannot support coaching (too short, or no rep identified). Returns a
 * result instead of throwing so callers can choose between retry and fail.
 */
export function validateStructuredTranscript(input: unknown): ValidationResult {
  const raw = (input ?? null) as Partial<StructuredTranscript> | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.turns))
    return { ok: false, reason: "Transcript JSON has no turns" };

  let lastEnd = 0;
  const turns: ParsedTurn[] = [];
  for (const candidate of raw.turns as unknown[]) {
    const turn = (candidate ?? {}) as Partial<StructuredTurn>;
    const text = typeof turn.text === "string" ? turn.text.trim() : "";
    const label = turn.tone?.label;
    if (!text || !isOneOf(SPEAKERS, turn.speaker) || !isOneOf(TONE_LABELS, label)) continue;
    const start_s = parseTimestamp(String(turn.start ?? "")) ?? lastEnd;
    const end_s = Math.max(start_s, parseTimestamp(String(turn.end ?? "")) ?? start_s);
    lastEnd = end_s;
    turns.push({
      speaker: turn.speaker,
      start: String(turn.start ?? ""),
      end: String(turn.end ?? ""),
      text,
      tone: { label, note: String(turn.tone?.note ?? "").slice(0, MAX_TONE_NOTE_CHARS) },
      overlap: turn.overlap === true,
      index: 0,
      start_s,
      end_s,
    });
  }
  turns.sort((a, b) => a.start_s - b.start_s);
  turns.forEach((turn, index) => {
    turn.index = index;
  });

  if (turns.length < 2) return { ok: false, reason: "Too little speech was transcribed to review" };
  if (!turns.some((turn) => turn.speaker === "rep"))
    return { ok: false, reason: "Gemini could not identify the rep in this recording" };

  return {
    ok: true,
    transcript: {
      schema_version: TRANSCRIPT_SCHEMA_VERSION,
      language: typeof raw.language === "string" && raw.language ? raw.language : "en",
      audio_quality: isOneOf(AUDIO_QUALITIES, raw.audio_quality) ? raw.audio_quality : "fair",
      speakers: Array.isArray(raw.speakers)
        ? (raw.speakers as StructuredTranscript["speakers"]).filter(
            (speaker) =>
              speaker &&
              (speaker.role === "rep" || speaker.role === "customer") &&
              typeof speaker.evidence === "string",
          )
        : [],
      turns,
    },
  };
}
