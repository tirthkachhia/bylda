// Arithmetic over Jev's per-exchange answers: deltas, learning moments, call
// summary, coaching value, and a call-quality composite. Pure module. All weights
// and thresholds live in WEIGHTS/THRESHOLDS so they can change without re-scoring.
import type { Exchange } from "./exchanges.ts";
import { TEMPERATURE_MAX } from "./jev-questions.ts";

export type LevelAnswer = {
  /** Probability-weighted level index, 0..3 for the 4-level questions. */
  score: number;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ExchangeScore = {
  exchange_index: number;
  temperature: LevelAnswer;
  rep_move?: LevelAnswer;
  playbook_step?: { choice: string; confidence: number };
  risk?: { probability: number };
  /** The Jev state for this exchange was trimmed to fit the token budget. */
  truncated: boolean;
};

export type ScoredExchange = ExchangeScore & { delta: number | null };

export type MomentType = "temperature_drop" | "risk_flag" | "weak_move";

export type LearningMoment = {
  exchange_index: number;
  type: MomentType;
  score: number;
  delta: number;
  confidence: number;
  risk_probability: number;
  rep_move: number | null;
  low_confidence: boolean;
};

export type CoachingValueLabel = "low" | "medium" | "high";

export type CallSummary = {
  exchange_count: number;
  duration_seconds: number | null;
  peak_temperature: number;
  final_temperature: number;
  biggest_drop: number;
  biggest_drop_exchange_index: number | null;
  mean_confidence: number;
  rep_move_average: number | null;
  playbook_coverage: number | null;
  risk_count: number;
  coaching_value_label: CoachingValueLabel;
  coaching_value_score: number;
  quality_score: number;
  features: Record<string, number | null>;
};

export const THRESHOLDS = {
  dropDelta: -0.5,
  risk: 0.6,
  weakMove: 1.0,
  lowConfidence: 0.5,
  coverageConfidence: 0.5,
  minExchangesForValue: 4,
  shortCallSeconds: 180,
  coldPeak: 0.75,
  highPeak: 1.75,
  highLoss: 0.75,
  bigDrop: -1.0,
  /** Risky statements at or above this count make a call worth reviewing on their own. */
  highRiskCount: 5,
} as const;

export const WEIGHTS = {
  coachingValue: { peak: 30, loss: 25, drop: 15, duration: 10, risk: 20 },
  quality: { repMove: 40, coverage: 30, lowRisk: 15, finalTemperature: 15 },
  durationCapSeconds: 1800,
} as const;

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

export function withDeltas(scores: ExchangeScore[]): ScoredExchange[] {
  const sorted = [...scores].sort((a, b) => a.exchange_index - b.exchange_index);
  return sorted.map((score, i) => ({
    ...score,
    delta: i === 0 ? null : round3(score.temperature.score - sorted[i - 1].temperature.score),
  }));
}

/**
 * Exchanges worth a manager's attention: a sharp temperature drop, a risk flag, or
 * a weak rep move that did not help. Only exchanges where the rep spoke qualify,
 * because a baseline (customer-only) exchange has no rep action to coach.
 */
export function findLearningMoments(
  scores: ScoredExchange[],
  exchanges: Exchange[],
  limit = 5,
): LearningMoment[] {
  const moments: LearningMoment[] = [];
  for (const s of scores) {
    if (!exchanges[s.exchange_index]?.rep) continue;
    const delta = s.delta ?? 0;
    // Weight by how sure Jev is about THIS exchange. Using the previous exchange's
    // confidence too let one uncertain earlier reading bury a clear later moment.
    const conf = s.temperature.confidence;
    const risk = s.risk?.probability ?? 0;
    const move = s.rep_move?.score;
    const drop = delta <= THRESHOLDS.dropDelta;
    const flagged = risk >= THRESHOLDS.risk;
    const weak = move !== undefined && move <= THRESHOLDS.weakMove && delta <= 0;
    if (!drop && !flagged && !weak) continue;
    const score =
      Math.max(0, -delta) * conf +
      (flagged ? 0.5 : 0) +
      (weak && move !== undefined ? (THRESHOLDS.weakMove + 0.5 - move) / 3 : 0);
    const type: MomentType = drop ? "temperature_drop" : flagged ? "risk_flag" : "weak_move";
    moments.push({
      exchange_index: s.exchange_index,
      type,
      score: round3(score),
      delta,
      confidence: round3(conf),
      risk_probability: round3(risk),
      rep_move: move === undefined ? null : round3(move),
      low_confidence: conf < THRESHOLDS.lowConfidence,
    });
  }
  const ranked = moments.sort((a, b) => b.score - a.score || a.exchange_index - b.exchange_index);
  const top = ranked.slice(0, limit);
  // A call's sharpest confident temperature drop is always worth a slot: a run of
  // risk flags must not push the moment the customer actually cooled off the list.
  if (limit > 0 && !top.some((m) => m.type === "temperature_drop")) {
    const bestDrop = ranked.find((m) => m.type === "temperature_drop" && !m.low_confidence);
    if (bestDrop)
      top.splice(Math.min(top.length, limit - 1), top.length === limit ? 1 : 0, bestDrop);
  }
  return top;
}

/**
 * How much a manager gains from reviewing this call. Two stories score high: a
 * customer who got warm and was lost, and a rep who said things a reviewer would
 * flag. Compliance risk counts even when the temperature never moved.
 */
export function coachingValue(input: {
  exchangeCount: number;
  durationSeconds: number | null;
  peak: number;
  final: number;
  biggestDrop: number;
  biggestDropConfident: boolean;
  riskCount?: number;
}): { label: CoachingValueLabel; score: number } {
  const { exchangeCount, durationSeconds, peak, final, biggestDrop, biggestDropConfident } = input;
  const riskCount = input.riskCount ?? 0;
  const loss = Math.max(0, peak - final);
  const duration = durationSeconds ?? 0;
  const w = WEIGHTS.coachingValue;
  const score = Math.round(
    w.peak * clamp01(peak / TEMPERATURE_MAX) +
      w.loss * clamp01(loss / TEMPERATURE_MAX) +
      w.drop * clamp01(-biggestDrop / TEMPERATURE_MAX) +
      w.duration * clamp01(duration / WEIGHTS.durationCapSeconds) +
      w.risk * clamp01(riskCount / THRESHOLDS.highRiskCount),
  );
  let label: CoachingValueLabel = "medium";
  if (
    exchangeCount < THRESHOLDS.minExchangesForValue ||
    (peak < THRESHOLDS.coldPeak && duration < THRESHOLDS.shortCallSeconds && riskCount === 0)
  )
    label = "low";
  else if (
    (peak >= THRESHOLDS.highPeak && loss >= THRESHOLDS.highLoss && exchangeCount >= 8) ||
    (biggestDrop <= THRESHOLDS.bigDrop && biggestDropConfident) ||
    riskCount >= THRESHOLDS.highRiskCount
  )
    label = "high";
  return { label, score };
}

export function qualityScore(input: {
  repMoveAverage: number | null;
  playbookCoverage: number | null;
  riskRate: number;
  finalTemperature: number;
}): number {
  const w = WEIGHTS.quality;
  const repMove = input.repMoveAverage === null ? 0.5 : clamp01(input.repMoveAverage / 3);
  const coverage = input.playbookCoverage === null ? 0.5 : clamp01(input.playbookCoverage);
  return Math.round(
    w.repMove * repMove +
      w.coverage * coverage +
      w.lowRisk * clamp01(1 - input.riskRate) +
      w.finalTemperature * clamp01(input.finalTemperature / TEMPERATURE_MAX),
  );
}

export function summarize(
  scores: ScoredExchange[],
  exchanges: Exchange[],
  guidelineCount: number,
  durationSeconds: number | null,
): CallSummary {
  const temps = scores.map((s) => s.temperature.score);
  const peak = temps.length ? Math.max(...temps) : 0;
  const final = temps.length ? temps[temps.length - 1] : 0;

  let biggestDrop = 0;
  let biggestDropIndex: number | null = null;
  let biggestDropConfident = false;
  const byIndex = new Map(scores.map((s) => [s.exchange_index, s]));
  for (const s of scores) {
    if (s.delta !== null && s.delta < biggestDrop && exchanges[s.exchange_index]?.rep) {
      biggestDrop = s.delta;
      biggestDropIndex = s.exchange_index;
      const prev = byIndex.get(s.exchange_index - 1);
      biggestDropConfident =
        s.temperature.confidence >= THRESHOLDS.lowConfidence &&
        (prev?.temperature.confidence ?? 1) >= THRESHOLDS.lowConfidence;
    }
  }

  const repMoves = scores.map((s) => s.rep_move?.score).filter((v): v is number => v !== undefined);
  const covered = new Set(
    scores
      .filter(
        (s) =>
          s.playbook_step &&
          s.playbook_step.choice !== "none" &&
          s.playbook_step.confidence >= THRESHOLDS.coverageConfidence,
      )
      .map((s) => s.playbook_step!.choice),
  );
  const coverage = guidelineCount > 0 ? round3(clamp01(covered.size / guidelineCount)) : null;
  const risks = scores.filter((s) => (s.risk?.probability ?? 0) >= THRESHOLDS.risk).length;
  const repExchanges = scores.filter((s) => exchanges[s.exchange_index]?.rep).length;
  const riskRate = repExchanges ? risks / repExchanges : 0;

  const value = coachingValue({
    exchangeCount: scores.length,
    durationSeconds,
    peak,
    final,
    biggestDrop,
    biggestDropConfident,
    riskCount: risks,
  });
  const repMoveAverage = mean(repMoves);
  const quality = qualityScore({
    repMoveAverage,
    playbookCoverage: coverage,
    riskRate,
    finalTemperature: final,
  });

  return {
    exchange_count: scores.length,
    duration_seconds: durationSeconds,
    peak_temperature: round3(peak),
    final_temperature: round3(final),
    biggest_drop: round3(biggestDrop),
    biggest_drop_exchange_index: biggestDropIndex,
    mean_confidence: round3(mean(scores.map((s) => s.temperature.confidence)) ?? 0),
    rep_move_average: repMoveAverage === null ? null : round3(repMoveAverage),
    playbook_coverage: coverage,
    risk_count: risks,
    coaching_value_label: value.label,
    coaching_value_score: value.score,
    quality_score: quality,
    features: {
      peak,
      final,
      loss: round3(Math.max(0, peak - final)),
      biggest_drop: biggestDrop,
      rep_move_average: repMoveAverage === null ? null : round3(repMoveAverage),
      playbook_coverage: coverage,
      risk_rate: round3(riskRate),
      exchange_count: scores.length,
      duration_seconds: durationSeconds,
    },
  };
}
