import { untyped, unwrap } from "../core/db";
import { NotBuiltError } from "../core/errors";
import type { CallInsightRow } from "../db-types";
import type { BehaviorRow, BehaviorScoreRow, BehavioralEventRow, PatternRow } from "./map";

/** C-01 · behavioral_events */
export async function fetchBehavioralEvents(_callId?: string): Promise<BehavioralEventRow[]> {
  throw new NotBuiltError("behavioral_events");
}
/** C-02 · behaviors */
export async function fetchBehaviors(): Promise<BehaviorRow[]> {
  throw new NotBuiltError("behaviors");
}
/** C-02 · behavior_scores (per rep / team, per week) */
export async function fetchBehaviorScores(): Promise<BehaviorScoreRow[]> {
  throw new NotBuiltError("behavior_scores");
}
/** C-15 · patterns */
export async function fetchPatterns(): Promise<PatternRow[]> {
  throw new NotBuiltError("patterns");
}

/** I4 — REAL today: objection lists from call_insights (AVAILABLE). */
export async function fetchObjectionRows(
  orgId: string,
): Promise<Pick<CallInsightRow, "call_id" | "objections">[]> {
  return (
    unwrap(
      await untyped()
        .from("call_insights")
        .select("call_id,objections")
        .eq("organization_id", orgId)
        .limit(500),
    ) ?? []
  );
}
