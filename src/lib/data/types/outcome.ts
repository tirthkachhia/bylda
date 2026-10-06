import type { Confidence } from "./common";

/** Dev Handoff `OutcomeAssociation` (21:114). Association only — never causal. */
export type OutcomeAssociation = {
  behaviorKey: string;
  behaviorName: string;
  outcome: "won" | "lost" | "advanced" | "next_step_booked";
  withRate: number;
  withoutRate: number;
  nWith: number;
  nWithout: number;
  /** closed outcomes available — hide the association when < 30 (show Y3). */
  nClosed: number;
  confidence: Confidence;
  confounders: string[];
};

export const OUTCOME_MIN_CLOSED = 30;
export const isOutcomeSufficient = (a: Pick<OutcomeAssociation, "nClosed">) =>
  a.nClosed >= OUTCOME_MIN_CLOSED;
