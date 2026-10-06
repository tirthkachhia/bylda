import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCtxQuery } from "../core/hook";
import { scopeRepId, type DataCtx } from "../core/context";
import { ForbiddenForRoleError } from "../core/errors";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { CALLS, SAVED_VIEWS, mockCallReview } from "../mocks/calls";
import { COACHING } from "../mocks/intelligence";
import type {
  Call,
  CallComparison,
  CallFilter,
  CallReview,
  SavedView,
  UploadResult,
} from "../types";
import { useDataCtx } from "../session/hooks";
import { fetchCallBundle, fetchCallRows, reanalyze, uploadUrl } from "./fetchers";
import { mapAnalysis, mapCallBundle, mapSegments } from "./map";
import { callKeys } from "./queryKeys";
import { SOURCE } from "./source";

// ── Pure loaders (testable without React) ────────────────────────────────────

/** Calls list. A REP only ever gets their own calls, whatever filter is passed. */
export async function loadCalls(ctx: DataCtx, filter: CallFilter = {}): Promise<Call[]> {
  const f: CallFilter = { ...filter, repId: scopeRepId(ctx, filter.repId) };
  if (resolveSource(SOURCE) === "mock") {
    return CALLS.filter(
      (c) =>
        (!f.repId || c.repId === f.repId) &&
        (!f.status || c.status === f.status) &&
        (!f.outcome || c.outcome === f.outcome) &&
        (!f.from || c.startedAt >= f.from),
    )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, f.limit ?? 100);
  }
  if (!ctx.orgId) return [];
  const bundles = await fetchCallRows(ctx.orgId, f);
  return bundles
    .map((b) => mapCallBundle(b))
    .filter((c) => (!f.status || c.status === f.status) && (!f.outcome || c.outcome === f.outcome));
}

/** C9 / R1 — always the signed-in user's own calls. */
export const loadMyCalls = (ctx: DataCtx) => loadCalls({ ...ctx, role: "rep" }, {});

/** C3–C6, R3. A rep asking for a peer's call gets FORBIDDEN_FOR_ROLE → render Y9. */
export async function loadCallReview(ctx: DataCtx, callId: string): Promise<CallReview | null> {
  if (resolveSource(SOURCE) === "mock") {
    const r = mockCallReview(callId);
    if (r && ctx.role === "rep" && r.call.repId !== ctx.userId)
      throw new ForbiddenForRoleError("a peer's call", ctx.role);
    return r
      ? { ...r, coaching: COACHING.filter((c) => c.evidence.some((e) => e.callId === callId)) }
      : null;
  }
  if (!ctx.orgId) return null;
  const b = await fetchCallBundle(ctx.orgId, callId);
  if (!b) return null;
  if (ctx.role === "rep" && b.call.user_id !== ctx.userId)
    throw new ForbiddenForRoleError("a peer's call", ctx.role);
  const call = mapCallBundle(b, !!b.transcript);
  const analysis = mapAnalysis(b.insight, b.job?.status ?? null);
  analysis.sentiment = b.transcript?.sentiment_score ?? null;
  return {
    call,
    transcript: mapSegments(b.transcript, call.repName),
    analysis,
    // GAP: behavioral_events — C-01
    events: [],
    // GAP: moments derive from behavioral_events + insights — C-06
    moments: [],
    // GAP: coaching_focuses — C-08
    coaching: [],
  };
}

/** C1 saved views. GAP: saved_views (C-24) — fixture in every mode. */
export async function loadSavedViews(ctx: DataCtx): Promise<SavedView[]> {
  void ctx;
  // GAP: saved_views — C-24
  return resolveSource(SOURCE) === "mock" ? SAVED_VIEWS : [];
}

/** C8 — derived client-side from two reviews (no backend needed). */
export async function loadCallComparison(
  ctx: DataCtx,
  a: string,
  b: string,
): Promise<CallComparison | null> {
  const [left, right] = await Promise.all([loadCallReview(ctx, a), loadCallReview(ctx, b)]);
  if (!left || !right) return null;
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  return {
    left,
    right,
    differences: [
      {
        label: "Talk share",
        left: pct(left.analysis.talkRatio),
        right: pct(right.analysis.talkRatio),
      },
      {
        label: "Objections",
        left: String(left.analysis.objections.length),
        right: String(right.analysis.objections.length),
      },
      {
        label: "Next steps",
        left: String(left.analysis.nextSteps.length),
        right: String(right.analysis.nextSteps.length),
      },
    ],
  };
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export const useCalls = (filter: CallFilter = {}) =>
  useCtxQuery(callKeys.list(filter), (ctx) => loadCalls(ctx, filter), isEmptyArray);
export const useMyCalls = () => useCtxQuery(callKeys.mine(), loadMyCalls, isEmptyArray);
export const useCallReview = (callId: string) =>
  useCtxQuery(
    callKeys.review(callId),
    (ctx) => loadCallReview(ctx, callId),
    (d) => d === null,
  );
export const useSavedViews = () => useCtxQuery(callKeys.savedViews(), loadSavedViews, isEmptyArray);
export const useCallComparison = (a: string, b: string) =>
  useCtxQuery(
    callKeys.compare(a, b),
    (ctx) => loadCallComparison(ctx, a, b),
    (d) => d === null,
    { enabled: !!a && !!b },
  );

/** C5 events on the timeline. */
export const useBehavioralEvents = (callId: string) =>
  useCtxQuery(
    callKeys.events(callId),
    async (ctx) => (await loadCallReview(ctx, callId))?.events ?? [],
    isEmptyArray,
  );

/** C7 — get an upload URL (get-call-ingest-url). */
export function useUploadCall() {
  const ctx = useDataCtx();
  return useMutation<UploadResult, Error, void>({
    mutationFn: async () => {
      if (resolveSource(SOURCE) === "mock")
        return {
          uploadUrl: "https://upload.invalid/mock",
          accepted: ["mp3", "m4a", "wav", "mp4", "vtt", "txt"],
          maxBytes: 2 * 1024 ** 3,
        };
      if (!ctx?.orgId) throw new Error("NO_ORG");
      const r = (await uploadUrl(ctx.orgId)) as unknown as { url?: string; ingest_url?: string };
      return {
        uploadUrl: r.url ?? r.ingest_url ?? "",
        accepted: ["mp3", "m4a", "wav", "mp4", "vtt", "txt"],
        maxBytes: 2 * 1024 ** 3,
      };
    },
  });
}

/** Y5 Retry — re-run analyze-call. */
export function useReanalyzeCall() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: async (callId) =>
      resolveSource(SOURCE) === "mock" ? { ok: true } : reanalyze(callId),
    onSuccess: (_d, callId) => void qc.invalidateQueries({ queryKey: callKeys.review(callId) }),
  });
}
