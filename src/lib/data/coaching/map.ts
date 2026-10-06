import type { CoachingComment, CoachingFocus } from "../types";

/** C-08 · proposed coaching_focuses row (result columns filled by the measure job). */
export type CoachingFocusRow = {
  id: string;
  organization_id: string;
  rep_id: string;
  rep_name: string;
  behavior_key: string;
  behavior_name: string;
  note: string;
  practice_script: string | null;
  evidence: {
    call_id: string;
    t_seconds: number;
    speaker: "rep" | "prospect" | "other";
    speaker_label: string;
    quote: string;
  }[];
  metric: string;
  baseline: number;
  target: number;
  judge_after_calls: number | null;
  judge_after_date: string | null;
  status: CoachingFocus["status"];
  result_value: number | null;
  result_verdict: "held" | "not_yet" | "reverted" | null;
  result_measured_on: string | null;
  result_sample_size: number | null;
  assigned_by: string;
  assigned_at: string;
  acknowledged_at: string | null;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const mapCoachingFocus = (r: CoachingFocusRow): CoachingFocus => ({
  id: r.id,
  repId: r.rep_id,
  repName: r.rep_name,
  behaviorKey: r.behavior_key,
  behaviorName: r.behavior_name,
  note: r.note,
  evidence: (r.evidence ?? []).map((e) => ({
    callId: e.call_id,
    timestamp: mmss(e.t_seconds),
    tSeconds: e.t_seconds,
    speaker: e.speaker,
    speakerLabel: e.speaker_label,
    quote: e.quote,
  })),
  metric: r.metric,
  baseline: r.baseline,
  target: r.target,
  judgeAfter: { calls: r.judge_after_calls, date: r.judge_after_date },
  status: r.status,
  result:
    r.result_verdict &&
    r.result_value !== null &&
    r.result_measured_on &&
    r.result_sample_size !== null
      ? {
          value: r.result_value,
          baseline: r.baseline,
          target: r.target,
          verdict: r.result_verdict,
          measuredOn: r.result_measured_on,
          sampleSize: r.result_sample_size,
        }
      : null,
  assignedById: r.assigned_by,
  assignedAt: r.assigned_at,
  acknowledgedAt: r.acknowledged_at,
});

/** C-09 · proposed coaching_comments row */
export type CoachingCommentRow = {
  id: string;
  focus_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
export const mapCoachingComment = (r: CoachingCommentRow): CoachingComment => ({
  id: r.id,
  focusId: r.focus_id,
  authorId: r.author_id,
  authorName: r.author_name,
  body: r.body,
  createdAt: r.created_at,
});
