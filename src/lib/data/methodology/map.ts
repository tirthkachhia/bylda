import { mapBehavior, type BehaviorRow } from "../behaviors/map";
import type { Methodology, ObjectionLibraryItem, SuccessCriterion } from "../types";

/** C-20 · proposed methodologies row (stages jsonb, behaviors joined). */
export type MethodologyRow = {
  id: string;
  organization_id: string;
  name: string;
  template: Methodology["template"];
  is_active: boolean;
  stages: { key: string; name: string; order: number; exit_criteria: string[] }[];
  behaviors: BehaviorRow[];
};
export const mapMethodology = (r: MethodologyRow): Methodology => ({
  id: r.id,
  name: r.name,
  template: r.template,
  isActive: r.is_active,
  stages: (r.stages ?? []).map((s) => ({
    key: s.key,
    name: s.name,
    order: s.order,
    exitCriteria: s.exit_criteria ?? [],
  })),
  behaviors: (r.behaviors ?? []).map(mapBehavior),
});

/** C-18 · proposed objection_library row */
export type ObjectionLibraryRow = {
  id: string;
  organization_id: string;
  label: string;
  category: string;
  recommended_response: string;
  seen_count: number;
};
export const mapObjectionLibrary = (r: ObjectionLibraryRow): ObjectionLibraryItem => ({
  id: r.id,
  label: r.label,
  category: r.category,
  recommendedResponse: r.recommended_response,
  seenCount: r.seen_count,
});

/** C-19 · proposed success_criteria row */
export type SuccessCriterionRow = {
  id: string;
  organization_id: string;
  outcome: SuccessCriterion["outcome"];
  enabled: boolean;
  source: SuccessCriterion["source"];
};
export const mapSuccessCriterion = (r: SuccessCriterionRow): SuccessCriterion => ({
  id: r.id,
  outcome: r.outcome,
  enabled: r.enabled,
  source: r.source,
});
