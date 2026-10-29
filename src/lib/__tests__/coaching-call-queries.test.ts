import { beforeEach, describe, expect, it, vi } from "vitest";
type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  failed: "",
  ranges: [] as Array<[number, number]>,
  dateFilter: "",
}));
vi.mock("@/lib/guest", () => ({ guestStore: { get: () => ({ isGuest: false }) } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: Array<(r: Row) => boolean> = [];
      let range: [number, number] | null = null;
      const result = () => {
        const rows = (state.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        return {
          data: state.failed === table ? null : range ? rows.slice(range[0], range[1] + 1) : rows,
          error: state.failed === table ? new Error("Query unavailable") : null,
          count: rows.length,
        };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((r) => r[key] === value);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          filters.push((r) => values.includes(r[key]));
          return query;
        },
        order: () => query,
        or: (value: string) => {
          state.dateFilter = value;
          return query;
        },
        range: (from: number, to: number) => {
          range = [from, to];
          state.ranges.push(range);
          return query;
        },
        maybeSingle: async () => {
          const response = result();
          return { ...response, data: response.data?.[0] ?? null };
        },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  },
}));
import { coachingCallQuery, loadCoachingCallsPage, repCallCountsQuery } from "../coaching/calls";
beforeEach(() => {
  state.tables = {
    calls: Array.from({ length: 51 }, (_, i) => ({
      id: `call-${i}`,
      organization_id: "org",
      rep_id: "rep",
      contact_id: "contact",
      lead_id: "deal",
      created_at: "2026-10-01",
      metadata: { audio_path: "org/audio.wav" },
      recording_url: "https://example.invalid/provider.wav",
    })),
    contacts: [
      { id: "contact", org_id: "org", first_name: "Ada", last_name: "Buyer", company: "Acme" },
    ],
    leads: [
      { id: "deal", organization_id: "org", name: "Acme rollout", stage: "Proposal", value: 5000 },
    ],
    reps: [{ id: "rep", organization_id: "org", name: "Jordan" }],
    call_transcripts: [
      {
        call_id: "call-0",
        organization_id: "org",
        transcript_text: "Original",
        speaker_segments: [],
      },
    ],
    call_insights: [],
  };
  state.failed = "";
  state.ranges = [];
  state.dateFilter = "";
});
describe("call hydration and exact-source reads", () => {
  it("returns 50 hydrated calls and an explicit next page without losing the 51st", async () => {
    const scope = { organizationId: "org", repId: null, since: null };
    const page = await loadCoachingCallsPage(scope);
    expect(page.calls).toHaveLength(50);
    expect(page.nextOffset).toBe(50);
    expect(page.total).toBe(51);
    expect(page.calls[0]).toMatchObject({
      contactName: "Ada Buyer",
      repName: "Jordan",
      dealStage: "Proposal",
      audio_path: "org/audio.wav",
      recording_url: "https://example.invalid/provider.wav",
    });
    const last = await loadCoachingCallsPage(scope, 50);
    expect(last.calls.map((c) => c.id)).toEqual(["call-50"]);
    expect(last.nextOffset).toBeNull();
  });
  it("does not open another call when the requested call is missing or belongs to another organization", async () => {
    for (const [org, id] of [
      ["org", "missing"],
      ["other", "call-0"],
    ]) {
      const query = coachingCallQuery(org, id);
      expect(await (query.queryFn as () => Promise<unknown>)()).toBeNull();
    }
  });
  it("rejects relation-query failures instead of treating unavailable data as empty", async () => {
    state.failed = "call_transcripts";
    await expect(
      loadCoachingCallsPage({ organizationId: "org", repId: "rep", since: null }),
    ).rejects.toThrow("Query unavailable");
  });
  it("validates dates before passing a normalized occurrence/fallback filter", async () => {
    await loadCoachingCallsPage({ organizationId: "org", repId: "rep", since: "2026-10-01" });
    expect(state.dateFilter).toContain("started_at.gte.2026-10-01T00:00:00.000Z");
    expect(state.dateFilter).toContain("started_at.is.null,created_at.gte.");
    await expect(
      loadCoachingCallsPage({ organizationId: "org", repId: null, since: "not-a-date" }),
    ).rejects.toThrow("Invalid call date range");
  });
});

describe("rep directory observed call counts", () => {
  it("reads all pages, scopes the organization and ignores unassigned calls", async () => {
    state.tables.calls = [
      ...Array.from({ length: 501 }, (_, i) => ({
        id: `c-${i}`,
        organization_id: "org",
        rep_id: "rep",
      })),
      { id: "unassigned", organization_id: "org", rep_id: null },
      { id: "foreign", organization_id: "another-org", rep_id: "rep" },
    ];
    const q = repCallCountsQuery("org", "2026-10-01T00:00:00.000Z");
    await expect(q.queryFn!({} as never)).resolves.toEqual({ rep: 501 });
    expect(state.ranges).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(state.dateFilter).toContain("started_at.gte.2026-10-01T00:00:00.000Z");
  });
  it("fails visibly instead of converting a failed query into zero", async () => {
    state.failed = "calls";
    const q = repCallCountsQuery("org", "2026-10-01T00:00:00.000Z");
    await expect(q.queryFn!({} as never)).rejects.toThrow("Query unavailable");
  });
});
