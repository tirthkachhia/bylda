import type { Confidence, Direction, ID, Sparkline } from "./common";
import type { Presence, Role } from "./session";

export type Person = {
  id: ID;
  name: string;
  firstName: string;
  role: Role;
  title: string | null;
  avatarUrl: string | null;
  presence: Presence | null;
  teamId: ID | null;
};

/** One behavior measured for one rep (or a team), on a fixed y-range. */
export type BehaviorScore = {
  behaviorKey: string;
  name: string;
  value: number;
  unit: "ratio" | "seconds" | "per_call" | "percent" | "count";
  /** Anonymous aggregate. `null` when the team has fewer than 8 reps (§4, §13.6) — hide the row. */
  teamMedian: number | null;
  direction: Direction;
  confidence: Confidence;
  sampleSize: number;
  sparkline: Sparkline;
};

export type RepSummary = {
  rep: Person;
  analyzedCalls: number;
  callsThisWeek: number;
  strengths: BehaviorScore[];
  leaks: BehaviorScore[];
  activeFocus: { focusId: ID; behaviorName: string; status: string } | null;
};

export type Team = {
  id: ID;
  name: string;
  managerId: ID | null;
  repIds: ID[];
  status: "active" | "setup";
  callsThisWeek: number;
  analyzedCalls: number;
};

/** Manager-only. Never served to a rep (loaders assert). */
export type RepComparisonRow = {
  behaviorKey: string;
  name: string;
  values: { repId: ID; value: number; n: number }[];
  teamMedian: number;
};
export type RepComparison = {
  repIds: ID[];
  rows: RepComparisonRow[];
  suggestedPairing: { repId: ID; withRepId: ID; reason: string } | null;
};
