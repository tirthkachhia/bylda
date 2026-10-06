import type { OutcomeAssociation } from "../types";

/** C-14 · proposed outcome_associations row */
export type OutcomeAssociationRow = {
  organization_id: string;
  team_id: string | null;
  behavior_key: string;
  behavior_name: string;
  outcome: OutcomeAssociation["outcome"];
  with_rate: number;
  without_rate: number;
  n_with: number;
  n_without: number;
  n_closed: number;
  confidence: OutcomeAssociation["confidence"];
  confounders: string[];
  computed_at: string;
};

export const mapOutcomeAssociation = (r: OutcomeAssociationRow): OutcomeAssociation => ({
  behaviorKey: r.behavior_key,
  behaviorName: r.behavior_name,
  outcome: r.outcome,
  withRate: r.with_rate,
  withoutRate: r.without_rate,
  nWith: r.n_with,
  nWithout: r.n_without,
  nClosed: r.n_closed,
  confidence: r.confidence,
  confounders: r.confounders ?? [],
});
