import type { EvidenceRef, ID, ISODate, SignalTone } from "./common";
import type { BehavioralEvent } from "./behavior";
import type { CoachingFocus } from "./coaching";
import type { TranscriptSegment } from "./transcript";

/** Dev Handoff `Call` (21:98). */
export type CallStatus = "processing" | "ready" | "failed" | "partial";
export type CallOutcome = "won" | "lost" | "advanced" | "no_decision" | "pending";

export type Call = {
  id: ID;
  repId: ID;
  repName: string;
  account: { id: ID | null; name: string };
  contactName: string | null;
  opportunityId: ID | null;
  startedAt: ISODate;
  durationSec: number;
  type: "discovery" | "demo" | "negotiation" | "follow_up" | "other";
  direction: "inbound" | "outbound" | null;
  /** Stage the deal was in when the call happened. */
  stageAtCall: string | null;
  outcome: CallOutcome | null;
  /** 0–100 — ranks Calls (C1) and Home (H1, H3). */
  coachingValue: number | null;
  status: CallStatus;
  keyMoments: number;
  topMoment: { label: string; tone: SignalTone; timestamp: string } | null;
  recordingUrl: string | null;
};

export type CallObjection = {
  label: string;
  timestamp: string | null;
  handled: "well" | "poorly" | "unclear";
};

export type CallAnalysis = {
  summary: string | null;
  objections: CallObjection[];
  competitors: string[];
  nextSteps: string[];
  /** rep share of talk time, 0–1 */
  talkRatio: number | null;
  sentiment: number | null;
  /** per-stage adherence, 0–1. GAP until Methodology exists. */
  methodologyAdherence: { stage: string; score: number }[];
  analysisStatus: "queued" | "running" | "completed" | "failed" | "none";
  analysisVersion: number | null;
};

/** Everything C3–C6 / R3 need. */
export type CallReview = {
  call: Call;
  transcript: TranscriptSegment[];
  analysis: CallAnalysis;
  events: BehavioralEvent[];
  moments: (EvidenceRef & { label: string; tone: SignalTone })[];
  coaching: CoachingFocus[];
};

export type CallFilter = {
  repId?: ID | null;
  teamId?: ID | null;
  outcome?: CallOutcome | null;
  status?: CallStatus | null;
  from?: ISODate | null;
  savedViewId?: ID | null;
  limit?: number;
};

export type SavedView = { id: ID; name: string; filter: CallFilter; count: number };

export type CallComparison = {
  left: CallReview;
  right: CallReview;
  differences: { label: string; left: string; right: string }[];
};

export type UploadResult = { uploadUrl: string; accepted: string[]; maxBytes: number };
