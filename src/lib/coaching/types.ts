import type {
  BehaviorAnalysis,
  BehaviorEvent,
  Evidence,
} from "../../../supabase/functions/_shared/coaching/behavior-intelligence";
import type { ParsedTurn } from "../../../supabase/functions/_shared/coaching/transcript-parse";

export type { BehaviorAnalysis, BehaviorEvent, Evidence };

/** The archive stores evidence separately from the event assessment. */
export type StoredBehaviorAssessment = Omit<
  BehaviorEvent,
  "context_evidence" | "rep_evidence" | "buyer_evidence"
>;

export type BehaviorRow = {
  id: string;
  run_id: string;
  call_id: string;
  rep_id: string | null;
  family: BehaviorEvent["family"];
  opportunity: BehaviorEvent["opportunity"];
  result: BehaviorEvent["result"];
  start_s: number | null;
  end_s: number | null;
  assessment: StoredBehaviorAssessment;
  evidence: { context: Evidence[]; rep: Evidence[]; buyer: Evidence[] };
};

/** Lightweight history projection; source snapshots are fetched only on demand. */
export type BehaviorRun = {
  id: string;
  call_id: string;
  rep_id: string | null;
  call_occurred_at: string;
  started_at: string;
  prompt_version: string;
  taxonomy_version: string;
  models: string[];
  analysis: BehaviorAnalysis;
};

export type BehaviorRunSource = BehaviorRun & {
  organization_id: string;
  transcript_hash: string;
  playbook_version_id: string | null;
  source_snapshot: {
    structured_turns: ParsedTurn[] | null;
    structured_meta: unknown;
    transcript_text: string;
  };
};

export type BehaviorFeedback = {
  id: string;
  event_id: string;
  reviewed_by: string;
  accuracy: "accurate" | "incorrect" | "uncertain";
  usefulness: "useful" | "unhelpful" | "uncertain";
  correction: string;
  created_at: string;
};

export type RepBehaviorHistory = { runs: BehaviorRun[]; events: BehaviorRow[] };

export type Rep = {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  email: string | null;
  status: "active" | "archived";
  /** Explicit playbook. Null falls back to the org's only active playbook when exactly one exists. */
  playbook_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Immutable snapshot of a playbook's text. Saving an edit inserts a new one. */
export type PlaybookVersion = {
  id: string;
  playbook_id: string;
  organization_id: string;
  version: number;
  content: string;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
};

/** One Jev-scored exchange, as stored in call_exchange_scores. Numerics arrive as strings from PostgREST. */
export type ExchangeScoreRow = {
  exchange_index: number;
  start_s: number | string | null;
  end_s: number | string | null;
  temperature_score: number | string;
  temperature_confidence: number | string;
  delta: number | string | null;
  rep_move_score: number | string | null;
  rep_move_confidence: number | string | null;
  playbook_step: string | null;
  playbook_step_confidence: number | string | null;
  risk_probability: number | string | null;
  truncated: boolean;
};

export type ScoreSummary = {
  call_id: string;
  rep_id: string | null;
  exchange_count: number;
  duration_seconds: number | null;
  peak_temperature: number | string;
  final_temperature: number | string;
  biggest_drop: number | string;
  biggest_drop_exchange_index: number | null;
  mean_confidence: number | string;
  rep_move_average: number | string | null;
  playbook_coverage: number | string | null;
  risk_count: number;
  coaching_value_label: "low" | "medium" | "high";
  coaching_value_score: number;
  quality_score: number;
  total_input_tokens: number | null;
  cost_usd: number | string | null;
  computed_at: string;
};

export type LearningMomentRow = {
  id: string;
  exchange_index: number;
  type: "temperature_drop" | "risk_flag" | "weak_move";
  score: number | string;
  delta: number | string | null;
  confidence: number | string | null;
  risk_probability: number | string | null;
  rep_move: number | string | null;
  low_confidence: boolean;
  rep_text: string | null;
  customer_text: string | null;
  /** Code-derived headline, present from scoring. */
  headline: string | null;
  /** Claude's explanation, present after analysis. */
  why_it_matters: string | null;
  what_to_say_instead: string | null;
  playbook_guideline: string | null;
  /** "playbook" when the cited guideline is verified in the playbook text; "general" for a built-in rule. */
  guideline_source: "playbook" | "general" | null;
  /** Canonical guideline id (coaching_playbook_guidelines) when the analyzer mapped one. */
  guideline_id?: string | null;
  /** Display code (G1..) joined from the guideline row. */
  guideline_code?: string | null;
};

export type CallScores = {
  rows: ExchangeScoreRow[];
  summary: ScoreSummary | null;
  moments: LearningMomentRow[];
};

/** Head record plus its current version, as playbooksQuery returns it. */
export type Playbook = {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  status: "active" | "archived";
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  current: Pick<PlaybookVersion, "id" | "version" | "content" | "created_at"> | null;
};

export type UploadStatus =
  | "queued"
  | "uploading"
  | "queued_transcription"
  | "analyzed"
  | "saved_no_transcript"
  | "failed";

/** Browser-local state for one file in a bulk upload. Not persisted. */
export type UploadItem = {
  file: File;
  status: UploadStatus;
  callId?: string;
  message?: string;
};

export type {
  RepReport,
  ReportCitation,
  ReportPattern,
} from "../../../supabase/functions/_shared/coaching/report-contract";
export type {
  SinceLast,
  StripRow,
  GuidelineTrend,
} from "../../../supabase/functions/_shared/coaching/report-trend";

/** One row of coaching_reports as repReportsQuery returns it. */
export type RepReportRow = {
  id: string;
  rep_id: string;
  period_start: string;
  period_end: string;
  trigger: "manual" | "scheduled";
  status: "running" | "completed" | "failed";
  error_message: string | null;
  call_count: number;
  playbook_version_id: string | null;
  report: import("../../../supabase/functions/_shared/coaching/report-contract").RepReport | null;
  drill_guideline_id: string | null;
  previous_report_id: string | null;
  delivered_at: string | null;
  created_at: string;
  completed_at: string | null;
};

export type {
  Guideline,
  GuidelinePhase,
} from "../../../supabase/functions/_shared/coaching/guidelines";

/** One row of coaching_playbook_guidelines: a behavior reps are judged on, stable per version. */
export type PlaybookGuidelineRow = {
  id: string;
  version_id: string;
  position: number;
  code: string;
  title: string;
  detail: string | null;
  phase: import("../../../supabase/functions/_shared/coaching/guidelines").GuidelinePhase;
};
