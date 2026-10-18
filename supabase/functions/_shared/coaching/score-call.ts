// Scores every exchange of a call with Jev and turns the answers into rows,
// a summary, and learning moments. Pure orchestration: the Jev call is injected
// so this runs identically in the worker and in tests.
import type { Exchange } from "./exchanges.ts";
import { buildJevRequest, TEMPERATURE_LEVELS } from "./jev-questions.ts";
import { isChoiceAnswer, isNoulAnswer, isScoreAnswer, type JevResponse } from "./jev-client.ts";
import {
  findLearningMoments,
  summarize,
  withDeltas,
  type CallSummary,
  type ExchangeScore,
  type LearningMoment,
  type ScoredExchange,
} from "./trajectory.ts";

export const SCORING_VERSION = 1;

export type AskFn = (state: unknown, questions: Record<string, unknown>) => Promise<JevResponse>;

export type ScoreExchangesResult = {
  scores: ExchangeScore[];
  totalInputTokens: number;
  model: string | null;
  /** Exchange indexes whose Jev request failed after retries. */
  failed: number[];
  /** Exchange indexes not scored because they were back-channel (see shouldScoreExchange). */
  skipped: number[];
};

/** Translate one Jev response into an ExchangeScore; null if the temperature answer is unusable. */
export function answersToScore(
  exchangeIndex: number,
  response: JevResponse,
  truncated: boolean,
): ExchangeScore | null {
  const temperature = response.answers.customer_temperature;
  if (!isScoreAnswer(temperature)) return null;
  const maxLevel = TEMPERATURE_LEVELS.length - 1;
  const clampLevel = (value: number) => Math.min(maxLevel, Math.max(0, value));
  const score: ExchangeScore = {
    exchange_index: exchangeIndex,
    temperature: {
      score: clampLevel(temperature.score),
      probabilities: temperature.probabilities,
      confidence: temperature.confidence,
    },
    truncated,
  };
  const move = response.answers.rep_move;
  if (isScoreAnswer(move))
    score.rep_move = {
      score: clampLevel(move.score),
      probabilities: move.probabilities,
      confidence: move.confidence,
    };
  const step = response.answers.playbook_step;
  if (isChoiceAnswer(step))
    score.playbook_step = { choice: step.choice, confidence: step.confidence };
  const risk = response.answers.rep_introduced_risk;
  if (isNoulAnswer(risk)) score.risk = { probability: Math.min(1, Math.max(0, risk.noul)) };
  return score;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export type SkipRule = { minCustomerWords: number; minRepWords: number };
/** Back-channel exchanges ("Yeah." / "Okay.") carry no signal; scoring them wastes a request. */
export const DEFAULT_SKIP_RULE: SkipRule = { minCustomerWords: 3, minRepWords: 6 };

const wordCount = (text: string | undefined | null) =>
  text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

/** Score an exchange when either side said something substantive, or it closes the call. */
export function shouldScoreExchange(
  exchange: Exchange,
  index: number,
  total: number,
  rule: SkipRule | false = DEFAULT_SKIP_RULE,
): boolean {
  if (rule === false || index === total - 1) return true;
  return (
    wordCount(exchange.customer?.text) >= rule.minCustomerWords ||
    wordCount(exchange.rep?.text) >= rule.minRepWords
  );
}

export type ScoreExchangesOptions = {
  goal?: string;
  concurrency?: number;
  budgetTokens?: number;
  windowSize?: number;
  skip?: SkipRule | false;
  /** Score only these exchange indexes (a chunk). Defaults to every eligible exchange. */
  indexes?: number[];
  /** Called as each exchange is scored, so callers can persist incrementally. */
  onScore?: (score: ExchangeScore) => Promise<void> | void;
};

/** Deterministic list of exchanges worth scoring, so chunked runs agree on the plan. */
export function eligibleIndexes(exchanges: Exchange[], skip: SkipRule | false = DEFAULT_SKIP_RULE) {
  const eligible: number[] = [];
  const skipped: number[] = [];
  exchanges.forEach((exchange, k) => {
    if (shouldScoreExchange(exchange, k, exchanges.length, skip)) eligible.push(k);
    else skipped.push(k);
  });
  return { eligible, skipped };
}

/**
 * One Jev request per eligible exchange, each over a backward-looking window,
 * run with bounded concurrency. A single failed exchange is skipped and reported;
 * more than a third failing throws, because a curve with that many holes misleads.
 */
export async function scoreExchanges(
  exchanges: Exchange[],
  guidelines: string[],
  ask: AskFn,
  options: ScoreExchangesOptions = {},
): Promise<ScoreExchangesResult> {
  const failed: number[] = [];
  let totalInputTokens = 0;
  let model: string | null = null;
  const plan = eligibleIndexes(exchanges, options.skip);
  const eligible = options.indexes
    ? options.indexes.filter((k) => k >= 0 && k < exchanges.length)
    : plan.eligible;
  const skipped = options.indexes ? [] : plan.skipped;
  const results = await mapWithConcurrency(eligible, options.concurrency ?? 6, async (k) => {
    const request = buildJevRequest({
      goal: options.goal,
      guidelines,
      exchanges,
      k,
      budgetTokens: options.budgetTokens,
      windowSize: options.windowSize,
    });
    try {
      const response = await ask(request.state, request.questions);
      totalInputTokens += response.usage.input_tokens ?? 0;
      model = response.model;
      const score = answersToScore(k, response, request.truncated);
      if (!score) {
        failed.push(k);
        return null;
      }
      if (options.onScore) {
        try {
          await options.onScore(score);
        } catch (error) {
          console.error("[score-call] onScore", k, error instanceof Error ? error.message : error);
        }
      }
      return score;
    } catch (error) {
      console.error("[score-call] exchange", k, error instanceof Error ? error.message : error);
      failed.push(k);
      return null;
    }
  });
  const scores = results.filter((s): s is ExchangeScore => s !== null);
  if (eligible.length > 0 && failed.length > eligible.length / 3)
    throw new Error(`Jev scoring failed for ${failed.length} of ${eligible.length} exchanges`);
  return {
    scores,
    totalInputTokens,
    model,
    failed: failed.sort((a, b) => a - b),
    skipped,
  };
}

export type ScoreArtifacts = {
  scored: ScoredExchange[];
  summary: CallSummary;
  moments: LearningMoment[];
};

export function buildScoreArtifacts(
  scores: ExchangeScore[],
  exchanges: Exchange[],
  guidelineCount: number,
  durationSeconds: number | null,
  momentLimit = 5,
): ScoreArtifacts {
  const scored = withDeltas(scores);
  return {
    scored,
    summary: summarize(scored, exchanges, guidelineCount, durationSeconds),
    moments: findLearningMoments(scored, exchanges, momentLimit),
  };
}
