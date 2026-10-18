/**
 * Report trend — behavior change between two periods, computed in code from
 * canonical adherence rows. The model never does arithmetic here: it receives
 * these lines as facts and writes around them.
 *
 * A guideline "counts" on a call when it was judged followed, partial, or
 * missed; not_applicable means the call never got there and is excluded.
 */
import type { ReportCall } from "./report-input.ts";

export type AdherenceStatus = "followed" | "partial" | "missed" | "not_applicable";

export type AdherenceRow = {
  call_id: string;
  guideline_id: string;
  status: AdherenceStatus;
};

export type GuidelineRef = { id: string; code: string; title: string };

export type Counts = { followed: number; partial: number; missed: number; judged: number };

export type GuidelineTrend = {
  guideline_id: string;
  code: string;
  title: string;
  current: Counts;
  previous: Counts;
  /** Change in follow rate (followed + half credit for partial, over judged), -1..1; null when a side has no data. */
  change: number | null;
};

export type SinceLast = {
  previous_period: { start: string; end: string } | null;
  calls: { current: number; previous: number };
  /** The guideline the last report asked the rep to practice, and how it went. */
  drill: GuidelineTrend | null;
  /** Largest real movements, best improvement first. */
  moved: GuidelineTrend[];
};

export type StripRow = {
  call_id: string;
  started_at: string | null;
  quality_score: number;
  risk_count: number;
  coaching_value_label: ReportCall["coaching_value_label"];
  /** Status of the drilled guideline on this call, or null when none was drilled or judged. */
  drill_status: AdherenceStatus | null;
};

export const TREND_LIMITS = { moved: 3, minJudged: 2, minChange: 0.25 } as const;

const empty = (): Counts => ({ followed: 0, partial: 0, missed: 0, judged: 0 });

export function tallyByGuideline(rows: AdherenceRow[]): Map<string, Counts> {
  const out = new Map<string, Counts>();
  for (const r of rows) {
    if (r.status === "not_applicable") continue;
    const c = out.get(r.guideline_id) ?? empty();
    c[r.status] += 1;
    c.judged += 1;
    out.set(r.guideline_id, c);
  }
  return out;
}

/** Follow rate with half credit for partial; null without judged calls. */
export const followRate = (c: Counts): number | null =>
  c.judged === 0 ? null : (c.followed + c.partial / 2) / c.judged;

export function guidelineTrend(
  g: GuidelineRef,
  current: Counts | undefined,
  previous: Counts | undefined,
): GuidelineTrend {
  const cur = current ?? empty();
  const prev = previous ?? empty();
  const a = followRate(cur);
  const b = followRate(prev);
  return {
    guideline_id: g.id,
    code: g.code,
    title: g.title,
    current: cur,
    previous: prev,
    change: a === null || b === null ? null : Number((a - b).toFixed(2)),
  };
}

export function buildSinceLast(args: {
  guidelines: GuidelineRef[];
  current: AdherenceRow[];
  previous: AdherenceRow[];
  currentCalls: number;
  previousCalls: number;
  previousPeriod: { start: string; end: string } | null;
  drillGuidelineId: string | null;
  limits?: typeof TREND_LIMITS;
}): SinceLast {
  const L = args.limits ?? TREND_LIMITS;
  const cur = tallyByGuideline(args.current);
  const prev = tallyByGuideline(args.previous);
  const trends = args.guidelines.map((g) => guidelineTrend(g, cur.get(g.id), prev.get(g.id)));
  const drill = args.drillGuidelineId
    ? (trends.find((t) => t.guideline_id === args.drillGuidelineId) ?? null)
    : null;
  const moved = trends
    .filter(
      (t) =>
        t.guideline_id !== args.drillGuidelineId &&
        t.change !== null &&
        Math.abs(t.change) >= L.minChange &&
        t.current.judged >= L.minJudged &&
        t.previous.judged >= L.minJudged,
    )
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
    .slice(0, L.moved);
  return {
    previous_period: args.previousPeriod,
    calls: { current: args.currentCalls, previous: args.previousCalls },
    drill,
    moved,
  };
}

const ofCalls = (c: Counts) =>
  c.judged === 0
    ? "not judged"
    : `${c.followed}${c.partial ? `+${c.partial} partial` : ""} of ${c.judged}`;

/** Facts for the prompt. Counts, never percentages: five calls is a small sample. */
export function renderSinceLast(s: SinceLast): string {
  if (s.calls.previous === 0 && !s.drill)
    return "SINCE LAST REPORT: no earlier period to compare against. Do not claim improvement or decline.";
  const lines = [
    `SINCE LAST REPORT (${s.previous_period ? `${s.previous_period.start} to ${s.previous_period.end}` : "previous period"}, ${s.calls.previous} call(s)) vs now (${s.calls.current} call(s)). Counts are followed of judged; treat small samples as indicative only.`,
  ];
  if (s.drill)
    lines.push(
      `- Last drill ${s.drill.code} "${s.drill.title}": now ${ofCalls(s.drill.current)}, before ${ofCalls(s.drill.previous)}.`,
    );
  for (const t of s.moved)
    lines.push(
      `- ${t.code} "${t.title}": ${t.change !== null && t.change > 0 ? "improved" : "slipped"}, now ${ofCalls(t.current)}, before ${ofCalls(t.previous)}.`,
    );
  if (!s.drill && !s.moved.length)
    lines.push("- No guideline moved meaningfully between the periods.");
  return lines.join("\n");
}

/** One row per call, in time order, for the call-by-call strip. */
export function buildCallStrip(
  calls: ReportCall[],
  rows: AdherenceRow[],
  drillGuidelineId: string | null,
): StripRow[] {
  const drill = new Map<string, AdherenceStatus>();
  if (drillGuidelineId)
    for (const r of rows) if (r.guideline_id === drillGuidelineId) drill.set(r.call_id, r.status);
  return [...calls]
    .sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""))
    .map((c) => ({
      call_id: c.call_id,
      started_at: c.started_at,
      quality_score: c.quality_score,
      risk_count: c.risk_count,
      coaching_value_label: c.coaching_value_label,
      drill_status: drill.get(c.call_id) ?? null,
    }));
}
