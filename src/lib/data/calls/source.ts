import type { Source } from "../core/source";

/**
 * hybrid — REAL: calls, call_transcripts, call_insights, call_analysis_jobs, contacts/leads
 * names (GAPS 07: AVAILABLE). MISSING, filled with contract defaults (never invented
 * numbers — CLAUDE.md §4): coachingValue, stageAtCall, opportunityId, type, keyMoments,
 * topMoment, behavioral events, moments, methodology adherence, saved views.
 */
export const SOURCE: Source = "hybrid";
