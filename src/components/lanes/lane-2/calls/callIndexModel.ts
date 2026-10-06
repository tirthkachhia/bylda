import type { Call, CallFilter, Viewer } from "@/lib/data";

export type LocalCallFilters = {
  search: string;
  days: string;
  rep: string;
  outcomes: string[];
  types: string[];
  stages: string[];
  duration: string;
};
export const emptyFilters = (): LocalCallFilters => ({
  search: "",
  days: "All dates",
  rep: "",
  outcomes: [],
  types: [],
  stages: [],
  duration: "Any length",
});
export function ownCalls(calls: Call[], viewer: Viewer): Call[] {
  return calls.filter((call) => call.repId === viewer.id);
}
export function filterCalls(
  calls: Call[],
  filters: LocalCallFilters,
  saved: CallFilter = {},
  now = new Date(),
): Call[] {
  const days = Number(filters.days.split(" ")[0]);
  const since =
    filters.days === "Today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      : Number.isFinite(days)
        ? now.getTime() - days * 86400000
        : -Infinity;
  const search = filters.search.trim().toLocaleLowerCase();
  return calls.filter(
    (call) =>
      (!saved.repId || call.repId === saved.repId) &&
      (!saved.outcome || call.outcome === saved.outcome) &&
      (!saved.status || call.status === saved.status) &&
      (!saved.from || call.startedAt >= saved.from) &&
      (!filters.rep || call.repId === filters.rep) &&
      Date.parse(call.startedAt) >= since &&
      (!filters.outcomes.length ||
        (call.outcome !== null && filters.outcomes.includes(call.outcome))) &&
      (!filters.types.length || filters.types.includes(call.type)) &&
      (!filters.stages.length ||
        (call.stageAtCall !== null && filters.stages.includes(call.stageAtCall))) &&
      (filters.duration !== "Under 15 min" || call.durationSec < 900) &&
      (filters.duration !== "15–60 min" || (call.durationSec >= 900 && call.durationSec <= 3600)) &&
      (filters.duration !== "Over 60 min" || call.durationSec > 3600) &&
      (!search ||
        [call.account.name, call.contactName, call.type, call.stageAtCall].some((value) =>
          value?.toLocaleLowerCase().includes(search),
        )),
  );
}
export function sortCalls(calls: Call[], sort: string): Call[] {
  return [...calls].sort((a, b) =>
    sort === "Coaching value"
      ? (b.coachingValue ?? -Infinity) - (a.coachingValue ?? -Infinity) ||
        b.startedAt.localeCompare(a.startedAt)
      : b.startedAt.localeCompare(a.startedAt),
  );
}
export function durationLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function medianDuration(calls: Call[]): number | null {
  if (!calls.length) return null;
  const values = calls.map((call) => call.durationSec).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
