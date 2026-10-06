import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataCtx } from "../session/hooks";
import { assertNotRep, scopeRepId, type DataCtx } from "../core/context";
import { ForbiddenForRoleError } from "../core/errors";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { COACHING } from "../mocks/intelligence";
import { personById } from "../mocks/people";
import type { AssignCoachingInput, CoachingComment, CoachingFocus, CoachingStatus } from "../types";
import {
  fetchCoachingComments,
  fetchCoachingFoci,
  postAcknowledge,
  postAssignCoaching,
} from "./fetchers";
import { mapCoachingComment, mapCoachingFocus } from "./map";
import { coachingKeys } from "./queryKeys";
import { SOURCE } from "./source";

export type CoachingFilter = { repId?: string; status?: CoachingStatus[] };

/** G3–G5, T5, T11, H4. A rep only ever sees their own focuses. */
export async function loadCoachingFoci(
  ctx: DataCtx,
  f: CoachingFilter = {},
): Promise<CoachingFocus[]> {
  const repId = scopeRepId(ctx, f.repId);
  const all =
    resolveSource(SOURCE) === "mock" ? COACHING : (await fetchCoachingFoci()).map(mapCoachingFocus);
  return all.filter(
    (c) => (!repId || c.repId === repId) && (!f.status || f.status.includes(c.status)),
  );
}

export const loadMyCoaching = (ctx: DataCtx) => loadCoachingFoci({ ...ctx, role: "rep" });

/** G6–G10, G12. A rep asking for a peer's focus is forbidden. */
export async function loadCoachingFocus(ctx: DataCtx, id: string): Promise<CoachingFocus | null> {
  const all =
    resolveSource(SOURCE) === "mock" ? COACHING : (await fetchCoachingFoci()).map(mapCoachingFocus);
  const f = all.find((c) => c.id === id) ?? null;
  if (f && ctx.role === "rep" && f.repId !== ctx.userId)
    throw new ForbiddenForRoleError("a peer's coaching", ctx.role);
  return f;
}

export async function loadCoachingComments(
  ctx: DataCtx,
  focusId: string,
): Promise<CoachingComment[]> {
  await loadCoachingFocus(ctx, focusId); // enforces rep scoping
  if (resolveSource(SOURCE) === "mock") {
    return [
      {
        id: "cc1",
        focusId,
        authorId: "u_dana",
        authorName: "Dana Whitfield",
        body: "Try it on the Brightline follow-up first.",
        createdAt: "2026-09-29T12:30:00Z",
      },
    ];
  }
  return (await fetchCoachingComments(focusId)).map(mapCoachingComment);
}

export const useCoachingFoci = (f: CoachingFilter = {}) =>
  useCtxQuery(coachingKeys.list(f), (ctx) => loadCoachingFoci(ctx, f), isEmptyArray);
export const useMyCoaching = () => useCtxQuery(coachingKeys.mine(), loadMyCoaching, isEmptyArray);
export const useCoachingFocus = (id: string) =>
  useCtxQuery(
    coachingKeys.one(id),
    (ctx) => loadCoachingFocus(ctx, id),
    (d) => d === null,
  );
export const useCoachingComments = (id: string) =>
  useCtxQuery(coachingKeys.comments(id), (ctx) => loadCoachingComments(ctx, id), isEmptyArray);

/** G2 Assign Coaching. Managers/coaches only. Mock mode returns the new focus locally. */
export function useAssignCoaching() {
  const qc = useQueryClient();
  const viewerCtx = useDataCtx();
  return useMutation<CoachingFocus, Error, AssignCoachingInput>({
    mutationFn: async (input) => {
      if (!viewerCtx) throw new Error("NOT_READY");
      const ctx = viewerCtx;
      assertNotRep(ctx, "assigning coaching");
      if (resolveSource(SOURCE) !== "mock")
        return mapCoachingFocus(await postAssignCoaching(input));
      return {
        id: `cf_${Date.now()}`,
        repId: input.repId,
        repName: personById(input.repId)?.name ?? input.repId,
        behaviorKey: input.behaviorKey,
        behaviorName: input.behaviorKey.replace(/_/g, " "),
        note: input.note,
        evidence: input.evidence,
        metric: "",
        baseline: 0,
        target: input.target,
        judgeAfter: { calls: input.judgeAfterCalls, date: null },
        status: "assigned",
        result: null,
        assignedById: ctx.userId,
        assignedAt: new Date().toISOString(),
        acknowledgedAt: null,
      };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: coachingKeys.all }),
  });
}

/** G11/B4 — the rep acknowledges their own focus. */
export function useAcknowledgeCoaching() {
  const qc = useQueryClient();
  const ctx = useDataCtx();
  return useMutation<CoachingFocus | null, Error, string>({
    mutationFn: async (focusId) => {
      if (!ctx) throw new Error("NOT_READY");
      const f = await loadCoachingFocus(ctx, focusId);
      if (!f) return null;
      if (resolveSource(SOURCE) !== "mock") return mapCoachingFocus(await postAcknowledge(focusId));
      return { ...f, status: "acknowledged", acknowledgedAt: new Date().toISOString() };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: coachingKeys.all }),
  });
}
