/**
 * Report input — turns the per-call rows we already store (score summaries,
 * explained learning moments, playbook adherence) into the compact, ranked
 * material a rep report is written from. Pure: no I/O, no model calls.
 *
 * The report must be succinct and specific, so this module does the hard
 * selection up front: moments are grouped into themes by the playbook guideline
 * they violate, themes are ranked by how many calls they touch, and only the
 * best-explained moments per theme survive. The model later writes prose over
 * this input and may cite only what is here.
 */

export type ReportCall = {
  call_id: string;
  started_at: string | null;
  duration_seconds: number | null;
  coaching_value_label: "low" | "medium" | "high";
  quality_score: number;
  risk_count: number;
  peak_temperature: number;
  final_temperature: number;
  rep_move_average: number | null;
};

export type ReportMoment = {
  call_id: string;
  exchange_index: number;
  type: "temperature_drop" | "risk_flag" | "weak_move" | "behavior_observation";
  behavior_family?: string;
  valence?: "strength" | "concern" | "mixed" | "unobservable";
  score: number;
  low_confidence: boolean;
  start_s: number | null;
  rep_text: string | null;
  customer_text: string | null;
  headline: string | null;
  why_it_matters: string | null;
  what_to_say_instead: string | null;
  playbook_guideline: string | null;
  guideline_source: "playbook" | "general" | null;
  /** Canonical guideline id when the analyzer mapped the moment to one. */
  guideline_id?: string | null;
};

export type ReportAdherence = {
  call_id: string;
  guideline: string;
  status: "followed" | "adapted" | "partial" | "missed" | "not_applicable" | "not_observable";
  /** Canonical guideline id when judged against extracted guidelines. */
  guideline_id?: string | null;
};

/** A moment as the report may cite it: enough to point a manager at the tape. */
export type CitedMoment = {
  call_id: string;
  exchange_index: number;
  at: string;
  rep_text: string;
  customer_text: string | null;
  why_it_matters: string | null;
  what_to_say_instead: string | null;
};

export type ReportTheme = {
  guideline: string;
  guideline_id: string | null;
  source: "playbook" | "general";
  call_count: number;
  moment_count: number;
  moments: CitedMoment[];
};

export type AdherenceTally = {
  guideline: string;
  guideline_id: string | null;
  followed: number;
  partial: number;
  missed: number;
};

export type ReportInput = {
  calls: {
    total: number;
    high_value: number;
    avg_quality: number | null;
    avg_rep_move: number | null;
    risk_flags: number;
    lost_warm_customers: number;
  };
  themes: ReportTheme[];
  adherence: AdherenceTally[];
  unexplained_moments: number;
};

export const REPORT_LIMITS = { themes: 4, momentsPerTheme: 2, adherence: 8 } as const;

const mmss = (s: number | null) => {
  const v = Math.max(0, Math.round(s ?? 0));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

const round = (v: number, places = 1) => Number(v.toFixed(places));

const mean = (values: number[]) =>
  values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;

/** Guidelines are quoted by the model, so two calls may phrase one rule slightly apart. */
export function guidelineKey(guideline: string): string {
  return guideline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

/** Explained, confident, high-score moments first; the report cites from the top. */
export function rankMoments(moments: ReportMoment[]): ReportMoment[] {
  return [...moments].sort(
    (a, b) =>
      Number(Boolean(b.why_it_matters)) - Number(Boolean(a.why_it_matters)) ||
      Number(a.low_confidence) - Number(b.low_confidence) ||
      b.score - a.score,
  );
}

export function toCitedMoment(m: ReportMoment): CitedMoment {
  return {
    call_id: m.call_id,
    exchange_index: m.exchange_index,
    at: mmss(m.start_s),
    rep_text: m.rep_text ?? "",
    customer_text: m.customer_text,
    why_it_matters: m.why_it_matters,
    what_to_say_instead: m.what_to_say_instead,
  };
}

/**
 * Group explained moments by the guideline they break. Themes that recur across
 * calls rank first; within a theme the best-explained moments are kept.
 */
export function groupThemes(
  moments: ReportMoment[],
  limits: { themes: number; momentsPerTheme: number } = REPORT_LIMITS,
): ReportTheme[] {
  const byKey = new Map<
    string,
    { theme: ReportTheme; calls: Set<string>; positive?: ReportMoment }
  >();
  for (const m of rankMoments(moments)) {
    if (!m.rep_text) continue;
    const themeLabel =
      m.playbook_guideline || m.behavior_family || m.headline || "General sales behavior";
    // A canonical id groups exactly; text is the fallback for older rows.
    const key = m.behavior_family
      ? `behavior:${m.behavior_family}`
      : m.guideline_id
        ? `id:${m.guideline_id}`
        : guidelineKey(themeLabel);
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        theme: {
          guideline: themeLabel,
          guideline_id: m.guideline_id ?? null,
          source: m.playbook_guideline ? (m.guideline_source ?? "general") : "general",
          call_count: 0,
          moment_count: 0,
          moments: [],
        },
        calls: new Set(),
      };
      byKey.set(key, entry);
    }
    if (m.valence === "strength" && !entry.positive) entry.positive = m;
    entry.theme.moment_count += 1;
    entry.calls.add(m.call_id);
    if (
      entry.theme.moments.length < limits.momentsPerTheme &&
      !entry.theme.moments.some((c) => c.call_id === m.call_id)
    ) {
      entry.theme.moments.push(toCitedMoment(m));
    }
  }
  return [...byKey.values()]
    .map(({ theme, calls, positive }) => {
      if (
        positive &&
        limits.momentsPerTheme > 0 &&
        !theme.moments.some(
          (m) => m.call_id === positive.call_id && m.exchange_index === positive.exchange_index,
        )
      ) {
        if (theme.moments.length >= limits.momentsPerTheme)
          theme.moments[theme.moments.length - 1] = toCitedMoment(positive);
        else theme.moments.push(toCitedMoment(positive));
      }
      return { ...theme, call_count: calls.size };
    })
    .sort((a, b) => b.call_count - a.call_count || b.moment_count - a.moment_count)
    .slice(0, limits.themes);
}

/** Count followed/partial/missed per guideline across calls; most-missed first. */
export function tallyAdherence(
  items: ReportAdherence[],
  limit: number = REPORT_LIMITS.adherence,
): AdherenceTally[] {
  const byKey = new Map<string, AdherenceTally>();
  for (const item of items) {
    if (
      item.status === "not_applicable" ||
      item.status === "not_observable" ||
      !item.guideline.trim()
    )
      continue;
    const key = item.guideline_id ? `id:${item.guideline_id}` : guidelineKey(item.guideline);
    const tally = byKey.get(key) ?? {
      guideline: item.guideline,
      guideline_id: item.guideline_id ?? null,
      followed: 0,
      partial: 0,
      missed: 0,
    };
    tally[item.status === "adapted" ? "followed" : item.status] += 1;
    byKey.set(key, tally);
  }
  return [...byKey.values()]
    .sort((a, b) => b.missed - a.missed || b.partial - a.partial || b.followed - a.followed)
    .slice(0, limit);
}

export function summarizeCalls(calls: ReportCall[]): ReportInput["calls"] {
  return {
    total: calls.length,
    high_value: calls.filter((c) => c.coaching_value_label === "high").length,
    avg_quality: mean(calls.map((c) => c.quality_score)),
    avg_rep_move: mean(
      calls.flatMap((c) => (c.rep_move_average === null ? [] : [c.rep_move_average])),
    ),
    risk_flags: calls.reduce((n, c) => n + c.risk_count, 0),
    lost_warm_customers: calls.filter(
      (c) => c.peak_temperature >= 1.75 && c.peak_temperature - c.final_temperature >= 0.75,
    ).length,
  };
}

export function buildReportInput(args: {
  calls: ReportCall[];
  moments: ReportMoment[];
  adherence: ReportAdherence[];
}): ReportInput {
  return {
    calls: summarizeCalls(args.calls),
    themes: groupThemes(args.moments),
    adherence: tallyAdherence(args.adherence),
    unexplained_moments: args.moments.filter((m) => !m.why_it_matters).length,
  };
}
