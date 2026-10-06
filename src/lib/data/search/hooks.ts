import { scopeRepId, type DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray } from "../core/query";
import { resolveSource } from "../core/source";
import { CALLS } from "../mocks/calls";
import { BEHAVIORS, PATTERNS } from "../mocks/intelligence";
import { PEOPLE } from "../mocks/people";
import type { PaletteItem, SearchFilter, SearchResponse } from "../types";
import { postSearchCalls } from "./fetchers";
import { mapSearchResponse } from "./map";
import { searchKeys } from "./queryKeys";
import { SOURCE } from "./source";

/** Mock parser: turns a question into visible, editable filter chips (S2 rule). */
function toFilters(q: string): SearchFilter[] {
  const f: SearchFilter[] = [];
  const lower = q.toLowerCase();
  for (const p of PEOPLE)
    if (lower.includes(p.firstName.toLowerCase()))
      f.push({ field: "rep", value: p.id, label: p.name });
  if (lower.includes("price") || lower.includes("pricing"))
    f.push({ field: "objection", value: "price", label: "Price objection" });
  if (lower.includes("lost")) f.push({ field: "outcome", value: "lost", label: "Lost" });
  if (lower.includes("won")) f.push({ field: "outcome", value: "won", label: "Won" });
  if (f.length === 0 && q.trim())
    f.push({ field: "text", value: q.trim(), label: `“${q.trim()}”` });
  return f;
}

/** S2/S3/B9 — every result links to a call. A rep's results are their own calls only. */
export async function loadSearch(
  ctx: DataCtx,
  query: string,
  windowDays = 30,
): Promise<SearchResponse> {
  if (resolveSource(SOURCE) !== "mock")
    return mapSearchResponse(await postSearchCalls({ query, window_days: windowDays }));
  const filters = toFilters(query);
  const rep = scopeRepId(ctx, filters.find((x) => x.field === "rep")?.value ?? null);
  const outcome = filters.find((x) => x.field === "outcome")?.value;
  const text = filters.find((x) => x.field === "text")?.value?.toLowerCase();
  const results = CALLS.filter(
    (c) =>
      (!rep || c.repId === rep) &&
      (!outcome || c.outcome === outcome) &&
      (!text || c.account.name.toLowerCase().includes(text)),
  )
    .slice(0, 10)
    .map((c) => ({
      callId: c.id,
      title: `${c.repName.split(" ")[0]} × ${c.account.name}`,
      repName: c.repName,
      startedAt: c.startedAt,
      snippet: c.topMoment?.label ?? "No key moment yet.",
      timestamp: c.topMoment?.timestamp ?? null,
      matched: filters.map((x) => x.field),
    }));
  return { query, filters, results, windowDays };
}

/** S1 ⌘K — navigation targets. Reps get no people/pattern entries. */
export async function loadPaletteItems(ctx: DataCtx, q: string): Promise<PaletteItem[]> {
  const lower = q.toLowerCase();
  const rep = ctx.role === "rep";
  const items: PaletteItem[] = [
    ...CALLS.filter((c) => !rep || c.repId === ctx.userId).map((c) => ({
      id: c.id,
      kind: "call" as const,
      label: `${c.repName} × ${c.account.name}`,
      hint: c.topMoment?.label ?? null,
      href: `/app/calls/${c.id}`,
    })),
    ...(rep
      ? []
      : PEOPLE.filter((p) => p.role === "rep").map((p) => ({
          id: p.id,
          kind: "person" as const,
          label: p.name,
          hint: p.title,
          href: `/app/team/reps/${p.id}`,
        }))),
    ...(rep
      ? []
      : BEHAVIORS.map((b) => ({
          id: b.key,
          kind: "behavior" as const,
          label: b.name,
          hint: "Behavior",
          href: `/app/intelligence/behaviors/${b.key}`,
        }))),
    ...(rep
      ? []
      : PATTERNS.map((p) => ({
          id: p.id,
          kind: "pattern" as const,
          label: p.headline,
          hint: "Pattern",
          href: "/app/intelligence/patterns",
        }))),
  ];
  return items.filter((i) => !lower || i.label.toLowerCase().includes(lower)).slice(0, 12);
}

export const useSearch = (query: string, windowDays = 30) =>
  useCtxQuery(
    searchKeys.search(query, windowDays),
    (ctx) => loadSearch(ctx, query, windowDays),
    (d) => d.results.length === 0,
    { enabled: query.trim().length > 0 },
  );
export const usePaletteItems = (q: string) =>
  useCtxQuery(searchKeys.palette(q), (ctx) => loadPaletteItems(ctx, q), isEmptyArray);
