import { ForbiddenForRoleError } from "../core/errors";
import type { DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { REPORTS, mockBrief } from "../mocks/collab";
import type { Brief, ReportListItem } from "../types";
import { isInsightSufficient } from "../types";
import { fetchBriefs } from "./fetchers";
import { mapBrief, toListItem } from "./map";
import { reportKeys } from "./queryKeys";
import { SOURCE } from "./source";

const REP_KINDS: Brief["kind"][] = ["daily_rep", "weekly_rep"];

/** P1. A rep sees only briefs about themselves. */
export async function loadReports(ctx: DataCtx): Promise<ReportListItem[]> {
  const all =
    resolveSource(SOURCE) === "mock"
      ? REPORTS
      : (await fetchBriefs()).map(mapBrief).map(toListItem);
  if (ctx.role !== "rep") return all;
  return all.filter(
    (r) =>
      REP_KINDS.includes(r.kind) && (resolveSource(SOURCE) !== "mock" || ctx.userId === "u_jordan"),
  );
}

/**
 * P2–P10. `idOrKind` is a brief id, or a kind ("daily_manager", "weekly_rep", …) for
 * "the latest one". A rep may open only their own rep briefs.
 */
export async function loadBrief(ctx: DataCtx, idOrKind: string): Promise<Brief | null> {
  const briefs: Brief[] =
    resolveSource(SOURCE) === "mock"
      ? (REPORTS.map((r) => mockBrief(r.id)).filter(Boolean) as Brief[])
      : (await fetchBriefs()).map(mapBrief);
  const b =
    briefs.find((x) => x.id === idOrKind) ?? briefs.find((x) => x.kind === idOrKind) ?? null;
  if (
    b &&
    ctx.role === "rep" &&
    (!REP_KINDS.includes(b.kind) || (b.subjectId && b.subjectId !== ctx.userId))
  ) {
    throw new ForbiddenForRoleError("another person's report", ctx.role);
  }
  // §13.13: a report never states a below-threshold insight.
  return b
    ? {
        ...b,
        sections: b.sections.map((s) => ({
          ...s,
          insights: s.insights.filter(isInsightSufficient),
        })),
      }
    : null;
}

export const useReports = () => useCtxQuery(reportKeys.list(), loadReports, isEmptyArray);
export const useBrief = (idOrKind: string) =>
  useCtxQuery(
    reportKeys.brief(idOrKind),
    (ctx) => loadBrief(ctx, idOrKind),
    (d) => d === null,
  );
