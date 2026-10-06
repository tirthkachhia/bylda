import type { QueryLike, TagTone } from "@/components/bylda";
import {
  ForbiddenForRoleError,
  TEAM_PATTERN_MIN_CALLS,
  patternShowsConfidence,
  isOutcomeSufficient,
  type Confidence,
  type GatedInsight,
  type Insight,
  type OutcomeAssociation,
  type Pattern,
  type PatternStatus,
} from "@/lib/data";

/** Pure logic for Intelligence screens I1 / I3 (and the tabs after them). No data fetching. */

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/**
 * I1 "Important today": team-wide insights that cleared the evidence gate, strongest first,
 * newest breaking ties. "Team-wide" = names no single rep (a rep's own insight belongs on their
 * profile and on Home, not on a team-level page).
 * GAP: the Insight type has no "important today" flag or rank (LANE_REQUESTS L1-1), so this is
 * the rule — a data-layer flag replaces it without touching the screen.
 */
export function importantToday(list: GatedInsight[], limit = 3): Insight[] {
  return list
    .flatMap((g) => (g.state === "insight" ? [g.insight] : []))
    .filter((i) => i.affectedRepIds.length === 0)
    .sort(
      (a, b) =>
        RANK[b.confidence] - RANK[a.confidence] ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    .slice(0, limit);
}

/** A pattern is "open" until it resolves. A row with no status yet (real mode) counts as open. */
export const isOpenPattern = (p: Pick<Pattern, "status">) => p.status !== "resolved";

export const STATUS_LABEL: Record<PatternStatus, string> = {
  emerging: "Emerging",
  confirmed: "Confirmed",
  fading: "Fading",
  resolved: "Resolved",
};

/**
 * Tag tone per lifecycle status. Colour is behavioral direction only (CLAUDE.md §3) and a Pattern
 * carries no direction (LANE_REQUESTS L1-1), so only the three statuses that have one get colour:
 * emerging = attention (watch it), resolved = improve (back to baseline). Confirmed and fading
 * are neutral — Figma tints "Confirmed" red or green by whether the behavior is good, which the
 * row can't say.
 */
export const STATUS_TONE: Record<PatternStatus, TagTone> = {
  emerging: "attention",
  confirmed: "neutral",
  fading: "neutral",
  resolved: "improve",
};

export function countByStatus(patterns: Pattern[]): Record<PatternStatus, number> {
  const out: Record<PatternStatus, number> = { emerging: 0, confirmed: 0, fading: 0, resolved: 0 };
  for (const p of patterns) if (p.status) out[p.status] += 1;
  return out;
}

/** "Mia Kowalski" → "MK". Initials of every rep a pattern names, in the order given. */
export function repInitials(ids: string[], names: Map<string, string>): string[] {
  return ids.flatMap((id) => {
    const name = names.get(id);
    if (!name) return [];
    const parts = name.trim().split(/\s+/);
    return [(parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()];
  });
}

/** "Sep 8" — UTC so a date-only value never slips a day. */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const CONFIDENCE_SHORT: Record<Confidence, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

/** What a pattern's confidence cell says: nothing for a resolved or zero-call pattern. */
export const confidenceCell = (p: Pattern) =>
  patternShowsConfidence(p) ? CONFIDENCE_SHORT[p.confidence] : "—";

/** A rate gap under this is noise, not an association. */
const WEAK_GAP = 0.05;

/** Funnel order, so a cell reads "Stage advanced, Won" whatever order the rows arrive in. */
const ORDER: OutcomeAssociation["outcome"][] = ["next_step_booked", "advanced", "won", "lost"];

const POSITIVE: Record<OutcomeAssociation["outcome"], string> = {
  advanced: "Stage advanced",
  won: "Won",
  next_step_booked: "Next step booked",
  lost: "Lost",
};
const NEGATIVE: Record<OutcomeAssociation["outcome"], string> = {
  advanced: "Fewer stage advances",
  won: "Fewer wins",
  next_step_booked: "No next step",
  lost: "Fewer losses",
};

/**
 * I1 ASSOCIATED WITH cell, from a behavior's OutcomeAssociation rows. Association language
 * only. Rows under n_closed 30 are ignored (§4); none left → "Not enough data"; every gap
 * under 5 points, or low confidence throughout → "Weak signal".
 */
export function associatedWith(rows: OutcomeAssociation[]): string {
  const ok = rows.filter(isOutcomeSufficient);
  if (ok.length === 0) return "Not enough data";
  const strong = ok
    .filter((r) => r.confidence !== "low" && Math.abs(r.withRate - r.withoutRate) >= WEAK_GAP)
    .sort((a, b) => ORDER.indexOf(a.outcome) - ORDER.indexOf(b.outcome));
  if (strong.length === 0) return "Weak signal";
  return strong
    .map((r) => (r.withRate >= r.withoutRate ? POSITIVE[r.outcome] : NEGATIVE[r.outcome]))
    .join(", ");
}

/** I3 selected pattern → the insight that explains it, when one names the same behavior and reps. */
export function insightForPattern(p: Pattern, list: GatedInsight[]): Insight | null {
  if (!p.behaviorKey || p.affectedRepIds.length === 0) return null;
  const want = [...p.affectedRepIds].sort().join();
  for (const g of list) {
    if (g.state !== "insight") continue;
    const i = g.insight;
    const key =
      i.action?.type === "assign_coaching" || i.action?.type === "open_behavior"
        ? i.action.behaviorKey
        : null;
    if (key === p.behaviorKey && [...i.affectedRepIds].sort().join() === want) return i;
  }
  return null;
}

/** True when any query was refused for the viewer's role (a rep). */
export const isForbidden = (...qs: Pick<QueryLike<unknown>, "error">[]) =>
  qs.some((q) => q.error instanceof ForbiddenForRoleError);

/** True only when the team's analyzed count is known and under the pattern floor (§13.13). */
export const belowPatternFloor = (analyzed: number | null | undefined) =>
  analyzed != null && analyzed < TEAM_PATTERN_MIN_CALLS;
