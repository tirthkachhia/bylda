import type { Source } from "../core/source";
/**
 * hybrid — MEMBERS are real (list_org_members RPC + profiles, GAPS 09 AVAILABLE).
 * teams / team_members, rep summaries and comparisons are MISSING (C-10, C-02, C-13):
 * mock in every mode until backend/teams lands.
 */
export const SOURCE: Source = "hybrid";
export const TEAMS_SOURCE: Source = "mock";
