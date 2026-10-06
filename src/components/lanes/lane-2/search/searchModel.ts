import type { Call, PaletteItem, SearchResponse, Viewer } from "@/lib/data";
export function visibleFilters(response: SearchResponse, viewer: Viewer) {
  return response.filters.filter(
    (f) => viewer.role !== "rep" || f.field !== "rep" || f.value === viewer.id,
  );
}
export function verifiedSearchCalls(
  response: SearchResponse,
  calls: Call[],
  viewer: Viewer,
  now = Date.now(),
) {
  if (!Number.isFinite(response.windowDays) || response.windowDays <= 0) return [];
  // The mock ignores objection/stage/behavior/date filters. Never label candidates as matches.
  if (response.filters.some((f) => !["rep", "outcome", "text", "account"].includes(f.field)))
    return [];
  if (
    viewer.role === "rep" &&
    response.filters.some((f) => f.field === "rep" && f.value !== viewer.id)
  )
    return [];
  const ids = new Set(response.results.map((r) => r.callId));
  return calls.filter(
    (c) =>
      ids.has(c.id) &&
      (viewer.role !== "rep" || c.repId === viewer.id) &&
      Date.parse(c.startedAt) <= now &&
      Date.parse(c.startedAt) >= now - response.windowDays * 86400000 &&
      response.filters.every((f) =>
        f.field === "rep"
          ? c.repId === f.value
          : f.field === "outcome"
            ? c.outcome === f.value
            : f.field === "account"
              ? c.account.id === f.value
              : c.account.name.toLowerCase().includes(f.value.toLowerCase()),
      ),
  );
}
export function safePaletteItems(items: PaletteItem[], calls: Call[], viewer: Viewer) {
  return items.flatMap((item) => {
    if (item.kind === "call") {
      const call = calls.find(
        (c) => c.id === item.id && (viewer.role !== "rep" || c.repId === viewer.id),
      );
      return call && item.href === `/app/calls/${call.id}`
        ? [{ ...item, label: `${call.repName} × ${call.account.name}`, hint: null }]
        : [];
    }
    if (viewer.role === "rep") return [];
    const prefix =
      item.kind === "person"
        ? "/app/team/reps/"
        : item.kind === "behavior"
          ? "/app/intelligence/behaviors/"
          : null;
    return prefix && /^[a-zA-Z0-9_-]+$/.test(item.id) && item.href === prefix + item.id
      ? [{ ...item, hint: null }]
      : [];
  });
}
