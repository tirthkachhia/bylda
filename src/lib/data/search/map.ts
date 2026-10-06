import type { SearchFilter, SearchResponse } from "../types";

/** C-21 · proposed search-calls response. */
export type SearchResponseRow = {
  query: string;
  window_days: number;
  filters: SearchFilter[];
  results: {
    call_id: string;
    title: string;
    rep_name: string;
    started_at: string;
    snippet: string;
    t_seconds: number | null;
    matched: SearchFilter["field"][];
  }[];
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const mapSearchResponse = (r: SearchResponseRow): SearchResponse => ({
  query: r.query,
  windowDays: r.window_days,
  filters: r.filters,
  results: r.results.map((x) => ({
    callId: x.call_id,
    title: x.title,
    repName: x.rep_name,
    startedAt: x.started_at,
    snippet: x.snippet,
    timestamp: x.t_seconds === null ? null : mmss(x.t_seconds),
    matched: x.matched,
  })),
});
