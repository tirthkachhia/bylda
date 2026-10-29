import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  requests: [] as Array<{ table: string; from: number; to: number }>,
  failure: null as { table: string; from: number } | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: Array<(row: Row) => boolean> = [];
      const orders: Array<{ key: string; ascending: boolean }> = [];
      const rows = () =>
        (state.tables[table] ?? [])
          .filter((r) => filters.every((f) => f(r)))
          .sort((a, b) => {
            for (const { key, ascending } of orders) {
              const compared = String(a[key] ?? "~").localeCompare(String(b[key] ?? "~"));
              if (compared) return ascending ? compared : -compared;
            }
            return 0;
          });
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value);
          return query;
        },
        is: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          filters.push((r) => values.includes(r[key]));
          return query;
        },
        gte: (key: string, value: string) => {
          filters.push((r) => String(r[key]) >= value);
          return query;
        },
        order: (key: string, options?: { ascending?: boolean }) => {
          orders.push({ key, ascending: options?.ascending !== false });
          return query;
        },
        range: async (from: number, to: number) => {
          state.requests.push({ table, from, to });
          if (state.failure?.table === table && state.failure.from === from)
            return { data: null, error: new Error("Page unavailable") };
          return { data: rows().slice(from, to + 1), error: null };
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      };
      return query;
    },
  },
}));

import {
  behaviorEventsQuery,
  behaviorFeedbackQuery,
  behaviorRunSourceQuery,
  repBehaviorQuery,
} from "../coaching/behavior";
import type { CallSourceTarget } from "../coaching/source-navigation";

beforeEach(() => {
  state.tables = {};
  state.requests = [];
  state.failure = null;
});
const pad = (n: number) => String(n).padStart(5, "0");
// Execute query functions without a React/provider or a live Supabase connection.
const read = <T>(options: { queryFn?: unknown }): Promise<T> =>
  (options.queryFn as () => Promise<T>)();

describe("complete behavioral reads", () => {
  it("paginates a run's events with stable ordering instead of stopping at the API limit", async () => {
    state.tables.coaching_behavior_events = Array.from({ length: 1201 }, (_, i) => ({
      id: `event-${pad(i)}`,
      run_id: "run",
      organization_id: "org",
      start_s: 0,
      end_s: 2,
    })).reverse();
    const data = await read<Array<{ id: string; end_s: number }>>(
      behaviorEventsQuery("run", "org"),
    );
    expect(data).toHaveLength(1201);
    expect(data[0]).toMatchObject({ id: "event-00000", end_s: 2 });
    expect(data.at(-1)?.id).toBe("event-01200");
    expect(state.requests.map((r) => r.from)).toEqual([0, 500, 1000]);
  });

  it("reads beyond 200 runs, deduplicates calls, and batches events for all retained calls", async () => {
    state.tables.coaching_analysis_runs = Array.from({ length: 620 }, (_, i) => ({
      id: `run-${pad(i)}`,
      call_id: i < 510 ? "repeated-call" : `call-${pad(i)}`,
      rep_id: "rep",
      organization_id: "org",
      call_occurred_at: "2026-10-01T00:00:00Z",
      started_at: new Date(Date.parse("2026-10-28T00:00:00Z") - i * 1000).toISOString(),
    }));
    state.tables.coaching_behavior_events = [
      ...Array.from({ length: 600 }, (_, i) => ({
        id: `event-${pad(i)}`,
        run_id: "run-00000",
        organization_id: "org",
      })),
      ...Array.from({ length: 110 }, (_, i) => ({
        id: `other-${pad(i)}`,
        run_id: `run-${pad(510 + i)}`,
        organization_id: "org",
      })),
      { id: "stale", run_id: "run-00001", organization_id: "org" },
      { id: "other-org", run_id: "run-00000", organization_id: "other" },
    ];
    const result = await read<{ runs: Row[]; events: Row[] }>(
      repBehaviorQuery("rep", "2026-09-01", "org"),
    );
    expect(result.runs).toHaveLength(111);
    expect(result.runs[0].id).toBe("run-00000");
    expect(result.events).toHaveLength(710);
    expect(result.events.some((r) => r.id === "stale" || r.id === "other-org")).toBe(false);
    expect(
      state.requests.filter((r) => r.table === "coaching_analysis_runs").map((r) => r.from),
    ).toEqual([0, 500]);
  });

  it("rejects the entire read when a later page fails rather than publishing partial counts", async () => {
    state.tables.coaching_behavior_events = Array.from({ length: 501 }, (_, i) => ({
      id: pad(i),
      run_id: "run",
    }));
    state.failure = { table: "coaching_behavior_events", from: 500 };
    await expect(read(behaviorEventsQuery("run"))).rejects.toThrow("Page unavailable");
  });

  it("canonicalizes feedback IDs and retrieves every batch/page without duplicates", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `event-${pad(i)}`);
    state.tables.coaching_behavior_feedback = [
      ...Array.from({ length: 601 }, (_, i) => ({
        id: `review-${pad(i)}`,
        event_id: ids[0],
        created_at: "2026-10-28",
      })),
      ...ids
        .slice(1)
        .map((event_id, i) => ({ id: `other-${pad(i)}`, event_id, created_at: "2026-10-27" })),
    ];
    expect(behaviorFeedbackQuery(ids).queryKey).toEqual(
      behaviorFeedbackQuery([...ids].reverse().concat(ids[0])).queryKey,
    );
    const result = await read<Row[]>(behaviorFeedbackQuery(ids.concat(ids[0])));
    expect(result).toHaveLength(701);
    expect(new Set(result.map((r) => r.id)).size).toBe(701);
  });
});

describe("exact source queries", () => {
  const target: CallSourceTarget = {
    organizationId: "org",
    repId: "rep",
    callId: "call",
    startSeconds: 0,
    source: { kind: "behavior", runId: "old-run", turnId: 0 },
  };
  it("fetches the cited run instead of the latest run and scopes all identity fields", async () => {
    state.tables.coaching_analysis_runs = [
      { id: "new-run", organization_id: "org", rep_id: "rep", call_id: "call" },
      {
        id: "old-run",
        organization_id: "org",
        rep_id: "rep",
        call_id: "call",
        transcript_hash: "old-hash",
        source_snapshot: { transcript_text: "original" },
      },
    ];
    expect(await read(behaviorRunSourceQuery(target))).toMatchObject({
      id: "old-run",
      transcript_hash: "old-hash",
    });
    for (const mismatch of [{ organizationId: "other" }, { repId: "other" }, { callId: "other" }])
      expect(await read(behaviorRunSourceQuery({ ...target, ...mismatch }))).toBeNull();
    expect(
      await read(
        behaviorRunSourceQuery({ ...target, source: { kind: "behavior", runId: "deleted" } }),
      ),
    ).toBeNull();
  });
  it("handles unassigned reps explicitly and separates cache entries by source scope", async () => {
    state.tables.coaching_analysis_runs = [
      { id: "old-run", organization_id: "org", rep_id: null, call_id: "call" },
    ];
    expect(await read(behaviorRunSourceQuery({ ...target, repId: null }))).toMatchObject({
      rep_id: null,
    });
    expect(await read(behaviorRunSourceQuery(target))).toBeNull();
    expect(behaviorRunSourceQuery(target).queryKey).not.toEqual(
      behaviorRunSourceQuery({ ...target, organizationId: "other" }).queryKey,
    );
    expect(behaviorRunSourceQuery(null).enabled).toBe(false);
    expect(behaviorRunSourceQuery({ ...target, source: { kind: "call" } }).enabled).toBe(false);
    await expect(read(behaviorRunSourceQuery(null))).rejects.toThrow("Invalid call source target");
  });
});
