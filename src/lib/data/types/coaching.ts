import type { EvidenceRef, ID, ISODate } from "./common";

/** Dev Handoff `CoachingFocus` (21:118) — Focus, Evidence, Acknowledgement, Result. */
export type CoachingStatus =
  | "assigned"
  | "acknowledged"
  | "measuring"
  | "held"
  | "not_yet"
  | "reverted";

export type CoachingResult = {
  value: number;
  baseline: number;
  target: number;
  verdict: "held" | "not_yet" | "reverted";
  measuredOn: ISODate;
  sampleSize: number;
};

export type CoachingFocus = {
  id: ID;
  repId: ID;
  repName: string;
  behaviorKey: string;
  behaviorName: string;
  note: string;
  evidence: EvidenceRef[];
  metric: string;
  baseline: number;
  target: number;
  /** judge after N calls or on a date */
  judgeAfter: { calls: number | null; date: ISODate | null };
  status: CoachingStatus;
  result: CoachingResult | null;
  assignedById: ID;
  assignedAt: ISODate;
  acknowledgedAt: ISODate | null;
};

export type CoachingComment = {
  id: ID;
  focusId: ID;
  authorId: ID;
  authorName: string;
  body: string;
  createdAt: ISODate;
};

export type AssignCoachingInput = {
  repId: ID;
  behaviorKey: string;
  note: string;
  evidence: EvidenceRef[];
  target: number;
  judgeAfterCalls: number;
};
