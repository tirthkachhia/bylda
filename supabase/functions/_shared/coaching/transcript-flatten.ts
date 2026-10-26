// Derives the legacy transcript columns from structured turns so the existing
// analyzer (transcript_text) and Transcript tab (speaker_segments) keep working.
// The structured turns themselves are stored separately and are the source of truth.
import type { ParsedTurn } from "./transcript-parse.ts";

const LABEL: Record<ParsedTurn["speaker"], string> = {
  rep: "Rep",
  customer: "Customer",
  unknown: "Unknown",
};

export type SpeakerSegment = {
  speaker: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  text: string;
  tone: ParsedTurn["tone"];
  overlap: boolean;
};

/** One "Rep: ..." / "Customer: ..." line per turn, newline-joined. */
export function flattenTranscript(turns: ParsedTurn[]): string {
  return turns.map((turn) => `${LABEL[turn.speaker]}: ${turn.text}`).join("\n");
}

/** Shape read by segmentLines() in src/lib/coaching/calls.ts, plus tone for the UI. */
export function toSpeakerSegments(turns: ParsedTurn[]): SpeakerSegment[] {
  return turns.map((turn) => ({
    speaker: LABEL[turn.speaker],
    start: turn.start_s,
    end: turn.end_s,
    text: turn.text,
    tone: turn.tone,
    overlap: turn.overlap,
  }));
}
