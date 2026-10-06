import type { CallInsightRow, CallTranscriptRow } from "../db-types";
import type {
  Call,
  CallAnalysis,
  CallFilter,
  CallObjection,
  CallReview,
  CallStatus,
  SavedView,
  TranscriptSegment,
} from "../types";
import type { CallRowBundle } from "./fetchers";

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** V1 status from what exists today: analysis job + transcript presence + telephony status. */
export function toCallStatus(
  b: Pick<CallRowBundle, "call" | "job" | "insight">,
  hasTranscript: boolean,
): CallStatus {
  if (b.job?.status === "failed" || b.call.status === "failed") return "failed";
  if (b.call.status === "voicemail" || b.call.status === "missed" || (b.call.duration ?? 0) < 60)
    return "partial";
  if (b.job?.status === "completed" || b.insight) return "ready";
  if (!hasTranscript && !b.job) return "partial";
  return "processing";
}

/** Today's real row → Call. MISSING fields get contract defaults, never invented values. */
export function mapCallBundle(b: CallRowBundle, hasTranscript = true): Call {
  const contactName = b.contact
    ? [b.contact.first_name, b.contact.last_name].filter(Boolean).join(" ") || null
    : null;
  return {
    id: b.call.id,
    repId: b.call.user_id ?? "",
    repName: b.rep?.full_name ?? "Unassigned",
    account: {
      id: b.lead?.id ?? null,
      name: b.contact?.company || b.lead?.name || contactName || "Unknown account",
    },
    contactName,
    // GAP: calls.opportunity_id — C-05
    opportunityId: null,
    startedAt: b.call.started_at ?? b.call.created_at,
    durationSec: b.call.duration ?? 0,
    // GAP: calls.call_type — C-05
    type: "other",
    direction: b.call.direction,
    // GAP: calls.stage_at_call — C-05
    stageAtCall: null,
    outcome: outcomeFromTag(b.call.outcome_tag),
    // GAP: calls.coaching_value — C-05 (ranks C1/H1/H3)
    coachingValue: null,
    status: toCallStatus(b, hasTranscript),
    // GAP: key moments come from behavioral_events — C-01
    keyMoments: 0,
    topMoment: null,
    recordingUrl: b.call.recording_url,
  };
}

function outcomeFromTag(tag: string | null): Call["outcome"] {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("won")) return "won";
  if (t.includes("lost")) return "lost";
  if (t.includes("advance") || t.includes("booked")) return "advanced";
  if (!t) return null;
  return "pending";
}

/** speaker_segments jsonb varies by provider (call-normalize.ts) — parse tolerantly. */
export function mapSegments(t: CallTranscriptRow | null, repName: string): TranscriptSegment[] {
  if (!t) return [];
  return asArray(t.speaker_segments).flatMap((raw, i) => {
    if (!raw || typeof raw !== "object") return [];
    const s = raw as Record<string, unknown>;
    const who = (str(s.speaker) ?? str(s.speaker_label) ?? str(s.role) ?? "").toLowerCase();
    const isRep =
      who.includes("rep") ||
      who.includes("agent") ||
      who.includes("user") ||
      who === "a" ||
      who === "speaker 0";
    const tStart = num(s.start) ?? num(s.start_time) ?? num(s.t_start) ?? 0;
    return [
      {
        id: `${t.call_id}-${i}`,
        speaker: isRep ? "rep" : who ? "prospect" : "other",
        speakerName: isRep ? repName : (str(s.speaker_name) ?? str(s.speaker) ?? "Prospect"),
        tStart,
        tEnd: num(s.end) ?? num(s.end_time) ?? num(s.t_end) ?? tStart,
        text: str(s.text) ?? str(s.transcript) ?? "",
      } satisfies TranscriptSegment,
    ];
  });
}

export function mapAnalysis(i: CallInsightRow | null, jobStatus: string | null): CallAnalysis {
  const objections: CallObjection[] = asArray(i?.objections).flatMap((o) => {
    if (typeof o === "string") return [{ label: o, timestamp: null, handled: "unclear" as const }];
    if (!o || typeof o !== "object") return [];
    const r = o as Record<string, unknown>;
    const t = num(r.t_seconds) ?? num(r.timestamp_seconds);
    return [
      {
        label: str(r.label) ?? str(r.objection) ?? str(r.text) ?? "Objection",
        timestamp: t !== null ? mmss(t) : str(r.timestamp),
        handled: "unclear" as const,
      },
    ];
  });
  return {
    summary: i?.summary ?? null,
    objections,
    competitors: asArray(i?.competitor_mentions)
      .map((c) => (typeof c === "string" ? c : (str((c as Record<string, unknown>)?.name) ?? "")))
      .filter(Boolean),
    nextSteps: asArray(i?.next_steps_extracted)
      .map((n) => (typeof n === "string" ? n : (str((n as Record<string, unknown>)?.text) ?? "")))
      .filter(Boolean),
    talkRatio: i?.talk_ratio ?? null,
    // GAP: per-call sentiment lives on call_transcripts.sentiment_score — filled by the caller
    sentiment: null,
    // GAP: methodology adherence — C-07
    methodologyAdherence: [],
    analysisStatus: (jobStatus === "queued" ||
    jobStatus === "running" ||
    jobStatus === "completed" ||
    jobStatus === "failed"
      ? jobStatus
      : i
        ? "completed"
        : "none") as CallAnalysis["analysisStatus"],
    analysisVersion: i?.analysis_version ?? null,
  };
}

// ── Contract C-05 · the proposed V1 call row (view v_calls_v1) ────────────────
export type CallV1Row = {
  id: string;
  organization_id: string;
  user_id: string;
  rep_name: string;
  account_id: string | null;
  account_name: string;
  contact_name: string | null;
  opportunity_id: string | null;
  started_at: string;
  duration: number;
  direction: "inbound" | "outbound" | null;
  call_type: "discovery" | "demo" | "negotiation" | "follow_up" | "other";
  stage_at_call: string | null;
  outcome: "won" | "lost" | "advanced" | "no_decision" | "pending" | null;
  coaching_value: number | null;
  status: "processing" | "ready" | "failed" | "partial";
  key_moment_count: number;
  top_moment_label: string | null;
  top_moment_tone: "improve" | "regress" | "attention" | "info" | "neutral" | null;
  top_moment_t_seconds: number | null;
  recording_url: string | null;
};

export function mapCallV1Row(r: CallV1Row): Call {
  return {
    id: r.id,
    repId: r.user_id,
    repName: r.rep_name,
    account: { id: r.account_id, name: r.account_name },
    contactName: r.contact_name,
    opportunityId: r.opportunity_id,
    startedAt: r.started_at,
    durationSec: r.duration,
    type: r.call_type,
    direction: r.direction,
    stageAtCall: r.stage_at_call,
    outcome: r.outcome,
    coachingValue: r.coaching_value,
    status: r.status,
    keyMoments: r.key_moment_count,
    topMoment:
      r.top_moment_label && r.top_moment_tone && r.top_moment_t_seconds !== null
        ? {
            label: r.top_moment_label,
            tone: r.top_moment_tone,
            timestamp: mmss(r.top_moment_t_seconds),
          }
        : null,
    recordingUrl: r.recording_url,
  };
}

export { mmss };

// ── C-10 · proposed call_moments view row ────────────────────────────────────
export type CallMomentRow = {
  call_id: string;
  t_seconds: number;
  speaker: "rep" | "prospect" | "other";
  speaker_label: string;
  quote: string;
  label: string;
  tone: "improve" | "regress" | "attention" | "info" | "neutral";
};
export const mapCallMoment = (r: CallMomentRow): CallReview["moments"][number] => ({
  callId: r.call_id,
  timestamp: mmss(r.t_seconds),
  tSeconds: r.t_seconds,
  speaker: r.speaker,
  speakerLabel: r.speaker_label,
  quote: r.quote,
  label: r.label,
  tone: r.tone,
});

// ── C-12 · proposed call_stage_scores row (methodology adherence per call) ───
export type CallStageScoreRow = {
  call_id: string;
  organization_id: string;
  methodology_id: string;
  stage_key: string;
  stage_name: string;
  score: number;
};
export const mapCallStageScore = (
  r: CallStageScoreRow,
): CallAnalysis["methodologyAdherence"][number] => ({ stage: r.stage_name, score: r.score });

// ── C-30 · proposed saved_views row ──────────────────────────────────────────
export type SavedViewRow = {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  filter: CallFilter;
  call_count: number;
  created_at: string;
};
export const mapSavedView = (r: SavedViewRow): SavedView => ({
  id: r.id,
  name: r.name,
  filter: r.filter ?? {},
  count: r.call_count,
});
