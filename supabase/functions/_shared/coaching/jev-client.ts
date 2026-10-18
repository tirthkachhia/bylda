// Minimal TypeSafe Jev (System One) HTTP client. Pure module with injectable fetch,
// used by the Cloudflare transcriber worker. Wire format pinned from
// docs.typesafe.ai/api on 2026-10-17: POST /v1/systemone { model, state, questions }.
import { JEV_MODEL } from "./jev-questions.ts";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
/** Jev bills input tokens only. USD per 1M input tokens, pinned 2026-10-17. */
export const JEV_INPUT_USD_PER_M = 0.042;

export type FetchLike = typeof fetch;

export type ScoreAnswer = {
  type: "score";
  /** Probability-weighted level index, 0..(levels-1), may be fractional. */
  score: number;
  probabilities: Record<string, number>;
  confidence: number;
  legend?: Record<string, string>;
};
export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type NoulAnswer = { type: "noul"; noul: number };
export type JevAnswer = ScoreAnswer | ChoiceAnswer | NoulAnswer;

export type JevUsage = { input_tokens?: number; output_tokens?: number };

export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: JevUsage;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function isScoreAnswer(value: unknown): value is ScoreAnswer {
  return (
    isRecord(value) &&
    value.type === "score" &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    isRecord(value.probabilities) &&
    typeof value.confidence === "number"
  );
}

export function isChoiceAnswer(value: unknown): value is ChoiceAnswer {
  return (
    isRecord(value) &&
    value.type === "choice" &&
    typeof value.choice === "string" &&
    isRecord(value.probabilities) &&
    typeof value.confidence === "number"
  );
}

export function isNoulAnswer(value: unknown): value is NoulAnswer {
  return (
    isRecord(value) &&
    value.type === "noul" &&
    typeof value.noul === "number" &&
    Number.isFinite(value.noul)
  );
}

/** Noul has no confidence field; the docs' proxy is |2p - 1| (0 at p=0.5, 1 at p=0 or 1). */
export const noulConfidence = (p: number) => Math.min(1, Math.max(0, Math.abs(2 * p - 1)));

export const jevCostUsd = (inputTokens: number) => (inputTokens * JEV_INPUT_USD_PER_M) / 1_000_000;

export class JevRequestError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`Jev request failed: ${status} ${body}`.trim());
    this.name = "JevRequestError";
    this.status = status;
  }
}

/**
 * One System One request. Retries 429 (rate limit) and 529 (overloaded) with
 * exponential backoff; any other failure throws with the response body, since 400
 * and 422 explain what was malformed.
 */
export async function askJev(
  state: unknown,
  questions: Record<string, unknown>,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
  options: { retries?: number; sleep?: (ms: number) => Promise<void>; timeoutMs?: number } = {},
): Promise<JevResponse> {
  const retries = options.retries ?? 2;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = options.timeoutMs ?? 60_000;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(JEV_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const data = (await res.json()) as Partial<JevResponse>;
      if (!isRecord(data.answers)) throw new JevRequestError(res.status, "response has no answers");
      return {
        model: typeof data.model === "string" ? data.model : JEV_MODEL,
        answers: data.answers as Record<string, JevAnswer>,
        usage: isRecord(data.usage) ? (data.usage as JevUsage) : {},
      };
    }
    const body = (await res.text().catch(() => "")).slice(0, 300);
    const retryable = res.status === 429 || res.status === 529;
    if (!retryable || attempt >= retries) throw new JevRequestError(res.status, body);
    await sleep(500 * 2 ** attempt);
  }
}
