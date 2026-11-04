import type { BehaviorAnalysis, Evidence } from "./types";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";
import { TONE_LABELS } from "../../../supabase/functions/_shared/coaching/transcript-schema";
import { validSourceSeconds } from "./source-navigation";

export type TimelineTrack = "Stage" | "Events" | "Talk" | "Control" | "Sentiment";
export type TimelineItem = {
  key: string;
  label: string;
  detail: string;
  start: number;
  end: number;
  evidence: Evidence;
  occurrence: string | null;
  color: "rep" | "customer" | "strength" | "concern" | "mixed" | "neutral";
};
export const TIMELINE_TRACKS: TimelineTrack[] = ["Stage", "Events", "Talk", "Control", "Sentiment"];
const human = (value: string) => value.replaceAll("_", " ");
const timed = (e: Evidence) => validSourceSeconds(e.start_s);
const interval = (e: Evidence) => timed(e) && validSourceSeconds(e.end_s) && e.end_s > e.start_s!;
const unionSeconds = (turns: Evidence[]) => {
  let seconds = 0,
    end = 0;
  for (const e of turns.filter(interval).sort((a, b) => a.start_s! - b.start_s!)) {
    seconds += Math.max(0, e.end_s! - Math.max(end, e.start_s!));
    end = Math.max(end, e.end_s!);
  }
  return seconds;
};

/** No guessed stage boundaries, mood scores, or duration inferred from word counts. */
export function buildCallTimeline(
  analysis: BehaviorAnalysis | null,
  evidence: Evidence[],
  structured: ParsedTurn[] | null,
  duration: number | null,
) {
  const tracks: Record<TimelineTrack, TimelineItem[]> = {
    Stage: [],
    Events: [],
    Talk: [],
    Control: [],
    Sentiment: [],
  };
  const source = new Map(evidence.map((e) => [e.turn_id, e]));
  let untimedEvents = 0;
  for (const event of analysis?.events ?? []) {
    const refs = [...event.rep_evidence, ...event.buyer_evidence]
      .map((e) => source.get(e.turn_id))
      .filter((e): e is Evidence => !!e && timed(e));
    const first = refs.sort((a, b) => a.start_s! - b.start_s!)[0];
    if (!first) {
      untimedEvents++;
      continue;
    }
    const item: TimelineItem = {
      key: event.occurrence_key,
      label: human(event.family),
      detail: event.rep_behavior,
      start: first.start_s!,
      end: Math.max(first.start_s!, ...refs.map((e) => e.end_s ?? e.start_s!)),
      evidence: first,
      occurrence: event.occurrence_key,
      color: event.result === "unobservable" ? "neutral" : event.result,
    };
    tracks.Events.push(item);
    if (event.stage !== "unknown")
      tracks.Stage.push({
        ...item,
        label: human(event.stage),
        detail: `Stage observed at this event: ${human(event.stage)}. ${event.rep_behavior}`,
      });
  }
  for (const [i, turn] of evidence.entries()) {
    if (!timed(turn)) continue;
    if (interval(turn))
      tracks.Talk.push({
        key: `talk-${turn.turn_id}`,
        label: turn.speaker,
        detail: turn.text,
        start: turn.start_s!,
        end: turn.end_s!,
        evidence: turn,
        occurrence: null,
        color: turn.speaker === "unknown" ? "neutral" : turn.speaker,
      });
    const raw = structured?.[turn.turn_id];
    if (
      raw?.text === turn.text &&
      raw.speaker === turn.speaker &&
      raw.start_s === turn.start_s &&
      raw.end_s === turn.end_s &&
      TONE_LABELS.includes(raw.tone?.label)
    )
      tracks.Sentiment.push({
        key: `tone-${turn.turn_id}`,
        label: `${turn.speaker}: ${raw.tone.label}`,
        detail: raw.tone.note || "Retained transcript tone estimate",
        start: turn.start_s!,
        end: turn.end_s ?? turn.start_s!,
        evidence: turn,
        occurrence: null,
        color:
          turn.speaker === "customer" ? "customer" : turn.speaker === "rep" ? "rep" : "neutral",
      });
    const next = evidence[i + 1];
    if (
      turn.speaker !== "unknown" &&
      turn.text.includes("?") &&
      next &&
      next.speaker !== "unknown" &&
      next.speaker !== turn.speaker &&
      timed(next) &&
      next.start_s! >= turn.start_s!
    )
      tracks.Control.push({
        key: `question-${turn.turn_id}`,
        label: `${turn.speaker === "rep" ? "Rep" : "Buyer"} question → response`,
        detail: `${turn.text}\nResponse: ${next.text}`,
        start: turn.start_s!,
        end: next.end_s ?? next.start_s!,
        evidence: turn,
        occurrence: null,
        color: turn.speaker,
      });
  }
  const extent = Math.max(
    validSourceSeconds(duration) ? duration : 0,
    ...evidence.filter(timed).map((e) => Math.max(e.start_s!, e.end_s ?? 0)),
    ...tracks.Events.map((e) => e.end),
    0,
  );
  return {
    tracks,
    duration: extent > 0 ? extent : null,
    untimedEvents,
    repSeconds: unionSeconds(evidence.filter((e) => e.speaker === "rep")),
    buyerSeconds: unionSeconds(evidence.filter((e) => e.speaker === "customer")),
    coveredSeconds: unionSeconds(evidence),
  };
}
