import { TONE_LABELS } from "./transcript-schema.ts";
import type { ParsedTurn } from "./transcript-parse.ts";

/** Provider-supplied roles/times survive ingestion. Names and channel numbers
 * alone do not establish a sales role, and missing tone is never "neutral". */
export function turnsFromSegments(value: unknown): ParsedTurn[] | null {
  if (!Array.isArray(value)) return null;
  const seconds = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  const turns: ParsedTurn[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const text =
      typeof raw.text === "string"
        ? raw.text.trim()
        : typeof raw.transcript === "string"
          ? raw.transcript.trim()
          : "";
    if (!text) continue;
    const role = String(raw.speaker_side || raw.role || raw.speaker || "").toLowerCase();
    const speaker = ["rep", "agent", "close-user"].includes(role)
      ? "rep"
      : ["customer", "buyer", "contact"].includes(role)
        ? "customer"
        : "unknown";
    const start = seconds(raw.start_s ?? raw.startTime ?? raw.start_time ?? raw.start);
    const end = seconds(raw.end_s ?? raw.endTime ?? raw.end_time ?? raw.end);
    const label = TONE_LABELS.includes(raw.tone?.label) ? raw.tone.label : "unknown";
    turns.push({
      index: turns.length,
      speaker,
      text,
      start: "",
      end: "",
      start_s: start,
      end_s: start !== null && end !== null && end >= start ? end : null,
      tone: { label, note: typeof raw.tone?.note === "string" ? raw.tone.note : "" },
      overlap: raw.overlap === true,
    });
  }
  return turns.length ? turns : null;
}
