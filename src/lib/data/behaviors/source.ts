import type { Source } from "../core/source";

/**
 * mock — BehavioralEvent, Behavior, behavior scores and patterns have NO tables
 * (GAPS 08: 95% missing). Real fetchers throw NOT_BUILT. Objection *frequency* (I4) is
 * buildable today from call_insights.objections — see OBJECTIONS_SOURCE.
 */
export const SOURCE: Source = "mock";
export const OBJECTIONS_SOURCE: Source = "hybrid";
