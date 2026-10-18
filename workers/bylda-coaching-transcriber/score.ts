// Jev scoring inside the worker, chunked to fit Cloudflare's per-invocation
// subrequest cap (50 on the Free plan). Each queue message scores CHUNK_SIZE
// eligible exchanges and enqueues the next chunk; the last chunk computes the
// summary and learning moments from the stored rows and triggers analysis.
// Judgement logic lives in _shared/coaching/score-call.ts; this file is IO.
import {
  groupExchanges,
  type Exchange,
} from "../../supabase/functions/_shared/coaching/exchanges.ts";
import { guidelinesFromPlaybook } from "../../supabase/functions/_shared/coaching/jev-questions.ts";
import { askJev, jevCostUsd } from "../../supabase/functions/_shared/coaching/jev-client.ts";
import {
  buildScoreArtifacts,
  eligibleIndexes,
  scoreExchanges,
  SCORING_VERSION,
} from "../../supabase/functions/_shared/coaching/score-call.ts";
import type { ParsedTurn } from "../../supabase/functions/_shared/coaching/transcript-parse.ts";
import type { ExchangeScore } from "../../supabase/functions/_shared/coaching/trajectory.ts";
import {
  momentContext,
  momentHeadline,
} from "../../supabase/functions/_shared/coaching/moments.ts";
import type { BaseEnv as Env } from "./env.ts";

type FetchLike = typeof fetch;

/** Jev calls per message. 15 Jev + ~10 other requests stays under the Free plan's 50. */
export const CHUNK_SIZE = 15;

export type ScoringCtx = {
  organizationId: string;
  userId: string;
  repId: string | null;
  durationSeconds: number | null;
  playbook: { id: string; versionId: string; guidelines: string[] } | null;
};

export type ScoringAcc = {
  startedAt: number;
  inputTokens: number;
  model: string | null;
  failed: number[];
};

export type ScoreChunk = {
  from: number; // offset into the eligible-index list
  size: number;
  ctx: ScoringCtx;
  acc: ScoringAcc;
};

function headers(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest<T>(
  env: Env,
  path: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<T> {
  const res = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(env), ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok)
    throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T>(env: Env, path: string, f: FetchLike) => rest<T>(env, path, { method: "GET" }, f);

/** One read: the structured turns for a call. */
export async function loadTurns(
  env: Env,
  callId: string,
  fetchImpl: FetchLike = fetch,
): Promise<ParsedTurn[] | null> {
  const rows = await get<Array<{ structured_turns: ParsedTurn[] | null }>>(
    env,
    `call_transcripts?call_id=eq.${encodeURIComponent(callId)}&select=structured_turns&limit=1`,
    fetchImpl,
  );
  const turns = rows[0]?.structured_turns;
  return Array.isArray(turns) && turns.length ? turns : null;
}

/** Resolve the context once (first chunk); later chunks carry it in the message. */
export async function resolveCtx(
  env: Env,
  callId: string,
  turns: ParsedTurn[],
  fetchImpl: FetchLike = fetch,
): Promise<ScoringCtx | null> {
  const calls = await get<
    Array<{
      organization_id: string;
      user_id: string;
      rep_id: string | null;
      duration: number | null;
    }>
  >(
    env,
    `calls?id=eq.${encodeURIComponent(callId)}&select=organization_id,user_id,rep_id,duration`,
    fetchImpl,
  );
  const call = calls[0];
  if (!call) return null;
  const lastEnd = turns[turns.length - 1]?.end_s;
  return {
    organizationId: call.organization_id,
    userId: call.user_id,
    repId: call.rep_id,
    durationSeconds: call.duration ?? (Number.isFinite(lastEnd) ? Math.round(lastEnd) : null),
    playbook: await resolvePlaybook(env, call.organization_id, call.rep_id, fetchImpl),
  };
}

/** Same resolution rule as analyze-call: explicit rep playbook, else the org's only active one. */
export async function resolvePlaybook(
  env: Env,
  organizationId: string,
  repId: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<ScoringCtx["playbook"]> {
  try {
    let playbookId: string | null = null;
    if (repId) {
      const reps = await get<Array<{ playbook_id: string | null }>>(
        env,
        `reps?id=eq.${repId}&select=playbook_id`,
        fetchImpl,
      );
      playbookId = reps[0]?.playbook_id ?? null;
    }
    if (!playbookId) {
      const active = await get<Array<{ id: string }>>(
        env,
        `coaching_playbooks?organization_id=eq.${organizationId}&status=eq.active&select=id&limit=2`,
        fetchImpl,
      );
      if (active.length === 1) playbookId = active[0].id;
    }
    if (!playbookId) return null;
    // One embedded read: head + current version content.
    const heads = await get<
      Array<{ id: string; current_version_id: string | null; current: { content: string } | null }>
    >(
      env,
      `coaching_playbooks?id=eq.${playbookId}&status=eq.active&select=id,current_version_id,current:coaching_playbook_versions!coaching_playbooks_current_version_fk(content)`,
      fetchImpl,
    );
    const head = heads[0];
    if (!head?.current_version_id) return null;
    const guidelines = guidelinesFromPlaybook(head.current?.content);
    return guidelines.length
      ? { id: head.id, versionId: head.current_version_id, guidelines }
      : null;
  } catch (error) {
    console.error("[score] playbook lookup", error instanceof Error ? error.message : error);
    return null;
  }
}

type ScoreRow = {
  exchange_index: number;
  temperature_score: number | string;
  temperature_confidence: number | string;
  temperature_probabilities: Record<string, number> | null;
  rep_move_score: number | string | null;
  rep_move_confidence: number | string | null;
  playbook_step: string | null;
  playbook_step_confidence: number | string | null;
  risk_probability: number | string | null;
  truncated: boolean;
};

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

/** Stored row -> ExchangeScore, for the final pass over all chunks. */
export function rowToScore(row: ScoreRow): ExchangeScore {
  const score: ExchangeScore = {
    exchange_index: row.exchange_index,
    temperature: {
      score: Number(row.temperature_score),
      probabilities: row.temperature_probabilities ?? {},
      confidence: Number(row.temperature_confidence),
    },
    truncated: !!row.truncated,
  };
  const move = num(row.rep_move_score);
  if (move !== null)
    score.rep_move = {
      score: move,
      probabilities: {},
      confidence: num(row.rep_move_confidence) ?? 0,
    };
  if (row.playbook_step)
    score.playbook_step = {
      choice: row.playbook_step,
      confidence: num(row.playbook_step_confidence) ?? 0,
    };
  const risk = num(row.risk_probability);
  if (risk !== null) score.risk = { probability: risk };
  return score;
}

function toRow(
  callId: string,
  ctx: ScoringCtx,
  exchanges: Exchange[],
  s: ExchangeScore,
  delta: number | null,
  model: string | null,
) {
  return {
    call_id: callId,
    organization_id: ctx.organizationId,
    exchange_index: s.exchange_index,
    start_s: exchanges[s.exchange_index]?.start_s ?? null,
    end_s: exchanges[s.exchange_index]?.end_s ?? null,
    temperature_score: s.temperature.score,
    temperature_confidence: s.temperature.confidence,
    temperature_probabilities: s.temperature.probabilities,
    delta,
    rep_move_score: s.rep_move?.score ?? null,
    rep_move_confidence: s.rep_move?.confidence ?? null,
    playbook_step: s.playbook_step?.choice ?? null,
    playbook_step_confidence: s.playbook_step?.confidence ?? null,
    risk_probability: s.risk?.probability ?? null,
    truncated: s.truncated,
    scoring_version: SCORING_VERSION,
    model,
    input_tokens: null,
  };
}

export type ChunkOutcome =
  | { status: "skipped"; reason: string }
  | { status: "next"; chunk: ScoreChunk }
  | {
      status: "done";
      exchangeCount: number;
      scoredCount: number;
      failed: number[];
      inputTokens: number;
      costUsd: number;
      coachingValue: string;
      qualityScore: number;
    };

/**
 * Score one chunk. Returns the next chunk to enqueue, or the final result after
 * the last chunk. Request budget per call: 1 turns read (+4 ctx reads on the
 * first chunk) + CHUNK_SIZE Jev + 1 row write (+ ~7 on the final chunk).
 */
export async function scoreChunk(
  env: Env,
  callId: string,
  chunk: ScoreChunk | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<ChunkOutcome> {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey) return { status: "skipped", reason: "TYPESAFE_API_KEY not set" };

  const turns = await loadTurns(env, callId, fetchImpl);
  if (!turns) return { status: "skipped", reason: "no structured turns" };
  const exchanges = groupExchanges(turns);
  const { eligible } = eligibleIndexes(exchanges);

  const ctx = chunk?.ctx ?? (await resolveCtx(env, callId, turns, fetchImpl));
  if (!ctx) return { status: "skipped", reason: "call not found" };
  const from = chunk?.from ?? 0;
  const size = chunk?.size ?? CHUNK_SIZE;
  const acc: ScoringAcc = chunk?.acc ?? {
    startedAt: Date.now(),
    inputTokens: 0,
    model: null,
    failed: [],
  };
  const guidelines = ctx.playbook?.guidelines ?? [];

  if (from === 0) {
    // Fresh run: clear rows from any previous scoring so skipped exchanges do not linger.
    await rest(
      env,
      `call_exchange_scores?call_id=eq.${callId}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
      fetchImpl,
    );
  }

  const indexes = eligible.slice(from, from + size);
  if (indexes.length) {
    const result = await scoreExchanges(
      exchanges,
      guidelines,
      (state, questions) =>
        askJev(state, questions, apiKey, fetchImpl, { retries: 1, timeoutMs: 20_000 }),
      { concurrency: 6, indexes },
    );
    acc.inputTokens += result.totalInputTokens;
    acc.model = result.model ?? acc.model;
    acc.failed.push(...result.failed);
    if (result.scores.length)
      await rest(
        env,
        "call_exchange_scores?on_conflict=call_id,exchange_index",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(
            result.scores.map((s) => toRow(callId, ctx, exchanges, s, null, acc.model)),
          ),
        },
        fetchImpl,
      );
  }

  const nextFrom = from + size;
  if (nextFrom < eligible.length)
    return { status: "next", chunk: { from: nextFrom, size, ctx, acc } };

  // Final pass: read every stored row, compute deltas/summary/moments, persist, record usage.
  const rows = await get<ScoreRow[]>(
    env,
    `call_exchange_scores?call_id=eq.${callId}&select=exchange_index,temperature_score,temperature_confidence,temperature_probabilities,rep_move_score,rep_move_confidence,playbook_step,playbook_step_confidence,risk_probability,truncated&order=exchange_index&limit=2000`,
    fetchImpl,
  );
  const scores = rows.map(rowToScore);
  const { scored, summary, moments } = buildScoreArtifacts(
    scores,
    exchanges,
    guidelines.length,
    ctx.durationSeconds,
  );
  const costUsd = jevCostUsd(acc.inputTokens);

  if (scored.length)
    await rest(
      env,
      "call_exchange_scores?on_conflict=call_id,exchange_index",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(
          scored.map((s) => toRow(callId, ctx, exchanges, s, s.delta, acc.model)),
        ),
      },
      fetchImpl,
    );
  await rest(
    env,
    "call_score_summaries?on_conflict=call_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        call_id: callId,
        organization_id: ctx.organizationId,
        rep_id: ctx.repId,
        ...summary,
        playbook_id: ctx.playbook?.id ?? null,
        playbook_version_id: ctx.playbook?.versionId ?? null,
        scoring_version: SCORING_VERSION,
        model: acc.model,
        total_input_tokens: acc.inputTokens,
        cost_usd: costUsd,
        computed_at: new Date().toISOString(),
      }),
    },
    fetchImpl,
  );
  await rest(
    env,
    `call_learning_moments?call_id=eq.${callId}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
    fetchImpl,
  );
  if (moments.length)
    await rest(
      env,
      "call_learning_moments",
      {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          moments.map((m) => ({
            call_id: callId,
            organization_id: ctx.organizationId,
            rep_id: ctx.repId,
            exchange_index: m.exchange_index,
            headline: momentHeadline(
              m,
              momentContext(
                exchanges,
                m.exchange_index,
                scored.find((s) => s.exchange_index === m.exchange_index)?.delta !== null
                  ? (scored.find((s) => s.exchange_index === m.exchange_index)?.temperature.score ??
                      0) - (scored.find((s) => s.exchange_index === m.exchange_index)?.delta ?? 0)
                  : null,
              ),
            ),
            type: m.type,
            score: m.score,
            delta: m.delta,
            confidence: m.confidence,
            risk_probability: m.risk_probability,
            rep_move: m.rep_move,
            low_confidence: m.low_confidence,
            rep_text: exchanges[m.exchange_index]?.rep?.text ?? null,
            customer_text: exchanges[m.exchange_index]?.customer?.text ?? null,
          })),
        ),
      },
      fetchImpl,
    );
  await rest(
    env,
    "usage_events",
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: ctx.userId,
        organization_id: ctx.organizationId,
        event_type: "call_scoring",
        resource_key: "coaching-jev",
        credits_used: 0,
        tokens_in: acc.inputTokens,
        tokens_out: 0,
        model: acc.model ?? "jev-latest",
        duration_ms: Date.now() - acc.startedAt,
        status: "succeeded",
        provider_name: "typesafe",
        actual_cost_usd: costUsd,
        routing_reason: "coaching_scoring",
        metadata: {
          call_id: callId,
          exchanges: exchanges.length,
          scored: scores.length,
          failed: acc.failed.length,
          chunks: Math.ceil(eligible.length / size),
        },
      }),
    },
    fetchImpl,
  ).catch((error) => console.error("[score] usage row", String(error)));

  return {
    status: "done",
    exchangeCount: exchanges.length,
    scoredCount: scores.length,
    failed: acc.failed,
    inputTokens: acc.inputTokens,
    costUsd,
    coachingValue: summary.coaching_value_label,
    qualityScore: summary.quality_score,
  };
}
