import type { TagTone } from "@/components/bylda";
import type {
  BehaviorDetail,
  Direction,
  Methodology,
  Pattern,
  PatternStatus,
  TeamBehaviorRow,
} from "@/lib/data";

/** Pure logic for the Intelligence tabs I7–I11. No data fetching. */

/** "Theo Brandt" → "Theo". The tables name reps by first name, as Figma does. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * I7 TAG column. Figma draws Up / Down / Steady (and a "Watch" that `Direction` can't carry —
 * LANE_REQUESTS L1-4). Colour = behavioral direction only (§3).
 */
export const I7_TAG: Record<Direction, { tone: TagTone; label: string }> = {
  improving: { tone: "improve", label: "Up" },
  regressing: { tone: "regress", label: "Down" },
  steady: { tone: "neutral", label: "Steady" },
};

/** I8 TAG column: the same direction, in the methodology's words (Up / Breaking / Steady). */
export const I8_TAG: Record<Direction, { tone: TagTone; label: string }> = {
  improving: { tone: "improve", label: "Up" },
  regressing: { tone: "regress", label: "Breaking" },
  steady: { tone: "neutral", label: "Steady" },
};

/**
 * The detail describes `key` — a defensive check, so a cell never shows one behavior's reps under
 * another's name. NB the mock loader relabels its fallback detail with the requested key, so in
 * mock mode this can't catch it (LANE_REQUESTS L1-4); real mode returns null for no detail.
 */
export const detailFor = (
  detail: BehaviorDetail | null | undefined,
  key: string,
): BehaviorDetail | null => (detail && detail.behavior.key === key ? detail : null);

/**
 * I7 BEST / NEEDS WORK: the top and bottom rep of `byRep`, ranked by the behavior's own direction
 * (`higherIsBetter`). Needs two reps to say anything; null otherwise ("—" in the cell).
 */
export function bestAndNeedsWork(
  detail: BehaviorDetail | null,
): { best: string; needsWork: string } | null {
  if (!detail || detail.byRep.length < 2) return null;
  const up = detail.behavior.higherIsBetter;
  const ranked = [...detail.byRep].sort((a, b) => (up ? b.value - a.value : a.value - b.value));
  return {
    best: firstName(ranked[0].repName),
    needsWork: firstName(ranked[ranked.length - 1].repName),
  };
}

/** I7 context panel default: the first regressing behavior, else the first row. */
export const distributionTarget = (rows: TeamBehaviorRow[]): TeamBehaviorRow | null =>
  rows.find((r) => r.direction === "regressing") ?? rows[0] ?? null;

/**
 * A band edge, compact enough for the 60px label column: "0.5s", "50%", "0.5". Per-call and count
 * values drop the unit — the panel heading names the behavior.
 */
export function bandValue(v: number, unit: BehaviorDetail["unit"]): string {
  const n = String(Math.round(v * 10) / 10);
  switch (unit) {
    case "seconds":
      return `${n}s`;
    case "percent":
      return `${Math.round(v)}%`;
    case "ratio":
      return `${Math.round(v * 100)}%`;
    default:
      return n;
  }
}

export type DistributionBucket = { label: string; reps: string[] };

/**
 * I7 DISTRIBUTION: reps grouped into four equal bands across the behavior's fixed y-range (the
 * same range its sparklines use, §4), so a band means the same thing every time. Labels as Figma
 * prints them: "< a", "a–b", "b–c", "> c". Empty bands stay, so the shape reads true.
 */
export function distribution(detail: BehaviorDetail, bands = 4): DistributionBucket[] {
  const { yMin, yMax } = detail.sparkline;
  const step = (yMax - yMin) / bands;
  if (!(step > 0)) return [];
  const edges = Array.from({ length: bands - 1 }, (_, i) => yMin + step * (i + 1));
  const f = (v: number) => bandValue(v, detail.unit);
  const out: DistributionBucket[] = Array.from({ length: bands }, (_, i) => ({
    label:
      i === 0
        ? `< ${f(edges[0])}`
        : i === bands - 1
          ? `> ${f(edges[bands - 2])}`
          : `${f(edges[i - 1])}–${f(edges[i])}`,
    reps: [],
  }));
  for (const r of detail.byRep) {
    const i = Math.min(bands - 1, Math.max(0, Math.floor((r.value - yMin) / step)));
    out[i].reps.push(firstName(r.repName));
  }
  return out;
}

/**
 * I8 WHERE THE PROCESS BREAKS: the methodology's enabled behaviors that the team row list tracks,
 * in the team list's order. A methodology behavior with no team row is left out (nothing measured).
 */
export function methodologyRows(
  methodology: Methodology,
  teamRows: TeamBehaviorRow[],
): TeamBehaviorRow[] {
  const keys = new Set(methodology.behaviors.filter((b) => b.enabled).map((b) => b.key));
  return teamRows.filter((r) => keys.has(r.behaviorKey));
}

/** The workspace's active methodology, else the first one. */
export const activeMethodology = (list: Methodology[]): Methodology | null =>
  list.find((m) => m.isActive) ?? list[0] ?? null;

/**
 * Card / panel tone per lifecycle status — same rule as I3 (`STATUS_TONE` in model.ts): a Pattern
 * has no direction, so only Emerging (watch it) and Resolved (back to baseline) carry colour.
 */
export const PATTERN_GLYPH_TONE: Record<PatternStatus, TagTone> = {
  emerging: "attention",
  confirmed: "neutral",
  fading: "neutral",
  resolved: "improve",
};

/**
 * I10 BY REP: one row per rep named by a rep pattern, in first-mention order, with how many of
 * their patterns are in each status. The tag names the most pressing status (emerging first).
 */
const PRESSING: PatternStatus[] = ["emerging", "confirmed", "fading", "resolved"];

export type RepPatternSummary = {
  repId: string;
  count: number;
  status: PatternStatus | null;
  /** "1 emerging", "2 confirmed", "1 pattern" when no status is known. */
  label: string;
  tone: TagTone;
};

export function repSummaries(patterns: Pattern[]): RepPatternSummary[] {
  const byRep = new Map<string, Pattern[]>();
  for (const p of patterns)
    for (const id of p.affectedRepIds) byRep.set(id, [...(byRep.get(id) ?? []), p]);
  return [...byRep.entries()].map(([repId, own]) => {
    const status = PRESSING.find((s) => own.some((p) => p.status === s)) ?? null;
    const count = status ? own.filter((p) => p.status === status).length : own.length;
    return {
      repId,
      count,
      status,
      label: `${count} ${status ?? (count === 1 ? "pattern" : "patterns")}`,
      tone: status ? PATTERN_GLYPH_TONE[status] : "neutral",
    };
  });
}

/** "38 calls", "1 call" — a pattern's n as the card prints it. */
export const callsLabel = (n: number) => `${n} ${n === 1 ? "call" : "calls"}`;
