import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataCtx } from "../core/context";
import { setSourceOverride, type Source } from "../core/source";
import { NOTIFICATIONS, REP_NOTIFICATIONS } from "../mocks/collab";
import { useHasUnread } from "../shell/hooks";
import type { Notification, NotificationType } from "../types";

const DANA: DataCtx = {
  userId: "u_dana",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "manager",
};
const JORDAN: DataCtx = { ...DANA, userId: "u_jordan", role: "rep" };
const viewer = vi.hoisted(() => ({ ctx: null as DataCtx | null }));

vi.mock("../session/hooks", () => ({ useDataCtx: () => viewer.ctx }));
vi.mock("./fetchers", () => ({ fetchNotifications: vi.fn(), markRead: vi.fn() }));

import { fetchNotifications, markRead } from "./fetchers";
import { mapNotificationRow, resetUnknownTypeWarnings } from "./map";
import {
  loadNotifications,
  resetMockNotificationState,
  useMarkNotificationRead,
  useNotifications,
} from "./hooks";

const fetchMock = vi.mocked(fetchNotifications);
const markMock = vi.mocked(markRead);

/**
 * Figma N2 (31:1258) tab counts: All 9 · Needs you 3 · Behavior 4 · Coaching 2 · Reports 1 · System 1.
 * Behavior + Coaching + Reports + System is only 8, so one type belongs to no category tab. The data
 * type has no category field; this is the mapping the counts imply (important_call is the orphan).
 * "Needs you" is the lane rule (LANE_REQUESTS #72): unread AND (tone regress or attention, OR an emerging
 * pattern), with no System exception. The lane implements it; it is mirrored here so the fixtures
 * are proven to exercise it.
 */
const TAB: Record<string, NotificationType[]> = {
  behavior: [
    "behavior_regression",
    "emerging_pattern",
    "methodology_breakdown",
    "behavior_improvement",
  ],
  coaching: ["coaching_completed", "coaching_acknowledged"],
  reports: ["report_ready"],
  system: ["integration_problem"],
};
const needsYou = (n: Notification) =>
  !n.read &&
  (n.severity === "regress" || n.severity === "attention" || n.type === "emerging_pattern");
const counts = (rows: Notification[]) => ({
  all: rows.length,
  needsYou: rows.filter(needsYou).length,
  ...Object.fromEntries(
    Object.entries(TAB).map(([k, types]) => [k, rows.filter((n) => types.includes(n.type)).length]),
  ),
});

/** The table as the server would return it. */
let db: { id: string; type: string; message: string; read: boolean; created_at: string }[] = [];
const seedDb = () => {
  db = NOTIFICATIONS.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.title,
    read: n.read,
    created_at: n.createdAt,
  }));
};

type Probe = {
  list: Notification[] | undefined;
  dot: boolean | undefined;
  mark: ReturnType<typeof useMarkNotificationRead>;
};
let qc: QueryClient;
let probe: Probe;
let unmount: () => void;

function mount(ctx: DataCtx) {
  viewer.ctx = ctx;
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  probe = { list: undefined, dot: undefined, mark: undefined as never };
  function Harness() {
    probe.list = useNotifications().data;
    probe.dot = useHasUnread().data;
    probe.mark = useMarkNotificationRead();
    return null;
  }
  const el = document.createElement("div");
  const root = createRoot(el);
  act(() =>
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(Harness))),
  );
  unmount = () => act(() => root.unmount());
}
/*
 * TanStack Query hands observer updates to React through setTimeout(0), after a failed mutation has
 * awaited onError/onSettled. The old flush() was also a setTimeout(0), registered earlier, so it
 * could return before the hook was told the write failed: the cache was already rolled back but
 * `probe.mark.error` was still undefined (a few runs in a hundred). The tests now own that tick:
 * the scheduler holds notifications, and flush() lets the microtasks drain, then releases them
 * inside act(). No timer is raced, and nothing reaches React outside act().
 */
const held: (() => void)[] = [];
const flush = () =>
  act(async () => {
    let released: (() => void)[];
    do {
      await new Promise((r) => setTimeout(r, 0)); // every pending microtask has run by now
      released = held.splice(0);
      for (const notify of released) notify();
    } while (released.length);
  });
const cached = () =>
  qc
    .getQueriesData<Notification[]>({ queryKey: ["notifications", "list"] })
    .flatMap(([, r]) => r ?? []);
const isRead = (id: string) => cached().find((n) => n.id === id)?.read;
const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setScheduler((notify) => void held.push(notify));
});
afterAll(() => {
  notifyManager.setScheduler((notify) => void setTimeout(notify, 0));
  setSourceOverride(null);
});
beforeEach(() => {
  held.length = 0;
  resetMockNotificationState();
  seedDb();
  fetchMock.mockReset();
  markMock.mockReset();
  fetchMock.mockImplementation(async () => db.map((r) => ({ ...r })));
});
afterEach(() => unmount?.());

const useSource = (s: Source) => setSourceOverride(s);

describe("fixtures match Figma N1 / N2", () => {
  it("has the nine rows, newest first, one per type", () => {
    expect(NOTIFICATIONS.map((n) => n.typeLabel)).toEqual([
      "BEHAVIOR REGRESSION",
      "IMPORTANT CALL",
      "EMERGING PATTERN",
      "REPORT READY",
      "COACHING COMPLETED",
      "COACHING ACKNOWLEDGED",
      "METHODOLOGY BREAKDOWN",
      "INTEGRATION PROBLEM",
      "BEHAVIOR IMPROVEMENT",
    ]);
    expect(new Set(NOTIFICATIONS.map((n) => n.type)).size).toBe(9);
    expect(new Set(NOTIFICATIONS.map((n) => n.id)).size).toBe(9);
    const at = NOTIFICATIONS.map((n) => Date.parse(n.createdAt));
    expect(at).toEqual([...at].sort((a, b) => b - a));
    expect(Math.max(...at)).toBeLessThanOrEqual(Date.now());
  });

  it("covers every severity, read and unread, with no body line", () => {
    expect(new Set(NOTIFICATIONS.map((n) => n.severity))).toEqual(
      new Set(["regress", "attention", "info", "improve"]),
    );
    expect(NOTIFICATIONS.filter((n) => !n.read).map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
    expect(NOTIFICATIONS.every((n) => n.body === null)).toBe(true);
  });

  it("exercises the Needs-you rule: read regress and attention rows are present and don't count", () => {
    const read = NOTIFICATIONS.filter((n) => n.read);
    expect(read.find((n) => n.type === "integration_problem")?.severity).toBe("regress");
    expect(read.find((n) => n.type === "methodology_breakdown")?.severity).toBe("attention");
    expect(NOTIFICATIONS.filter(needsYou).map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("splits 4 Today / 5 Earlier relative to now, and reproduces the tab counts", () => {
    const sameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString();
    const now = new Date();
    const today = NOTIFICATIONS.filter((n) => sameDay(n.createdAt, now));
    expect(today).toHaveLength(4);
    expect(NOTIFICATIONS.length - today.length).toBe(5);
    expect(counts(NOTIFICATIONS)).toEqual({
      all: 9,
      needsYou: 3,
      behavior: 4,
      coaching: 2,
      reports: 1,
      system: 1,
    });
  });

  it.each([
    ["just after midnight", new Date(2026, 0, 15, 0, 3)],
    ["mid-morning", new Date(2026, 0, 15, 9, 30)],
    ["late evening", new Date(2026, 0, 15, 23, 59)],
  ])("keeps 4 Today / 5 Earlier %s (dates are relative, not fixed)", async (_label, at) => {
    vi.useFakeTimers();
    vi.setSystemTime(at);
    try {
      vi.resetModules();
      const fresh = await import("../mocks/collab");
      const rows = [...fresh.NOTIFICATIONS, ...(fresh.REP_NOTIFICATIONS.u_jordan ?? [])];
      for (const list of [fresh.NOTIFICATIONS, fresh.REP_NOTIFICATIONS.u_jordan]) {
        const ts = list.map((n) => Date.parse(n.createdAt));
        expect(ts).toEqual([...ts].sort((a, b) => b - a));
        expect(Math.max(...ts)).toBeLessThanOrEqual(at.getTime());
      }
      const today = fresh.NOTIFICATIONS.filter(
        (n) => new Date(n.createdAt).toDateString() === at.toDateString(),
      );
      expect(today).toHaveLength(4);
      expect(rows.length).toBe(13);
    } finally {
      vi.useRealTimers();
      vi.resetModules();
    }
  });
});

describe("rep view (CLAUDE.md §4, LANE_REQUESTS #72) — scoped by whose row it is", () => {
  beforeEach(() => useSource("mock"));

  it("manager sees exactly the nine Figma rows and none of the rep's", async () => {
    const rows = await loadNotifications(DANA);
    expect(rows).toHaveLength(9);
    const mine = new Set((REP_NOTIFICATIONS.u_jordan ?? []).map((n) => n.id));
    for (const n of rows) expect(mine.has(n.id)).toBe(false);
  });

  it("rep sees only their own four rows: regression, call, improvement, coaching", async () => {
    const rows = await loadNotifications(JORDAN);
    expect(rows.map((n) => [n.id, n.type])).toEqual([
      ["n10", "behavior_regression"],
      ["n13", "important_call"],
      ["n11", "behavior_improvement"],
      ["n12", "coaching_acknowledged"],
    ]);
    expect(rows.some((n) => n.read)).toBe(true);
    expect(rows.some((n) => !n.read)).toBe(true);
  });

  it("every rep-facing row is about Jordan alone: second person, no one else named", async () => {
    for (const n of await loadNotifications(JORDAN)) {
      expect(`${n.title} ${n.body ?? ""}`).toMatch(/\b(Your|You)\b/);
      expect(`${n.title} ${n.body ?? ""}`).not.toMatch(
        /Sarah|Alex|Mia|Priya|Theo|Nina|Dana|Kiran|team|manager|Aircall|integration/i,
      );
      expect(["integration_problem", "emerging_pattern", "methodology_breakdown"]).not.toContain(
        n.type,
      );
    }
  });

  it("rep never sees a manager-inbox row: team alerts, other reps, the manager brief", async () => {
    const mine = new Set((await loadNotifications(JORDAN)).map((n) => n.id));
    for (const n of NOTIFICATIONS) expect(mine.has(n.id)).toBe(false);
  });

  it("a rep with no inbox sees nothing (fail-closed)", async () => {
    expect(await loadNotifications({ ...JORDAN, userId: "u_alex" })).toEqual([]);
    expect(Object.keys(REP_NOTIFICATIONS)).toEqual(["u_jordan"]);
  });
});

describe("roles the visibility doc doesn't define (docs/notification-visibility.md)", () => {
  beforeEach(() => useSource("mock"));

  it.each(["owner", "admin", "manager"] as const)(
    "%s sees the nine workspace rows",
    async (role) => {
      expect(await loadNotifications({ ...DANA, role })).toHaveLength(9);
    },
  );

  it.each(["coach", "viewer"] as const)(
    "%s sees nothing: not the manager's rows, not a rep's",
    async (role) => {
      expect(await loadNotifications({ ...DANA, role })).toEqual([]);
      expect(await loadNotifications({ ...JORDAN, role })).toEqual([]);
    },
  );

  it.each(["coach", "viewer"] as const)("%s gets no unread dot", async (role) => {
    mount({ ...DANA, role });
    await flush();
    expect(cached()).toEqual([]);
    expect(probe.dot).toBe(false);
  });
});

describe("useMarkNotificationRead — mock mode", () => {
  beforeEach(() => {
    useSource("mock");
    mount(DANA);
  });

  it("flips the row, updates the counts, and survives a refetch", async () => {
    await flush();
    expect(counts(cached()).needsYou).toBe(3);
    act(() => probe.mark.mutate("n1"));
    await flush();
    expect(isRead("n1")).toBe(true);
    expect(counts(cached()).needsYou).toBe(2);
    await act(() => qc.invalidateQueries({ queryKey: ["notifications", "list"] }));
    expect(isRead("n1")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(markMock).not.toHaveBeenCalled();
  });

  it("bell dot reads the same cache: it clears when the last unread row is marked", async () => {
    await flush();
    expect(probe.dot).toBe(true);
    for (const id of ["n1", "n2"]) act(() => probe.mark.mutate(id));
    await flush();
    expect(probe.dot).toBe(true); // n3 still unread
    act(() => probe.mark.mutate("n3"));
    await flush();
    expect(probe.dot).toBe(false);
    expect(cached().every((n) => n.read)).toBe(true);
  });

  it("works the same for a rep, on their own row", async () => {
    unmount();
    mount(JORDAN);
    await flush();
    expect(cached().map((n) => n.id)).toEqual(["n10", "n13", "n11", "n12"]);
    expect(probe.dot).toBe(true);
    act(() => probe.mark.mutate("n10"));
    await flush();
    expect(isRead("n10")).toBe(true);
    expect(probe.dot).toBe(true); // n13 still unread
    act(() => probe.mark.mutate("n13"));
    await flush();
    expect(probe.dot).toBe(false);
  });

  it("rolls back and surfaces the error when the write fails", async () => {
    await flush();
    const before = cached();
    act(() => probe.mark.mutate("nope"));
    await flush();
    expect(probe.mark.error?.message).toBe("NOTIFICATION_NOT_FOUND");
    expect(cached()).toEqual(before);
  });
});

describe("mark-read follows the same authorization as reads (docs/notification-visibility.md)", () => {
  beforeEach(() => useSource("mock"));

  /** Fire one write and return its error message, or undefined if it went through. */
  const attempt = async (id: string) => {
    let message: string | undefined;
    await act(async () => {
      await probe.mark.mutateAsync(id).catch((e: Error) => void (message = e.message));
    });
    return message;
  };

  it("a rep cannot mark a manager-inbox row, and it looks exactly like an id that isn't there", async () => {
    mount(JORDAN);
    await flush();
    const denied = await attempt("n1"); // a real row, in Dana's inbox
    const missing = await attempt("does_not_exist");
    expect(denied).toBe("NOTIFICATION_NOT_FOUND");
    expect(denied).toBe(missing);
    // nothing moved: Jordan's own rows are untouched and Dana still sees n1 unread
    expect(cached().map((n) => [n.id, n.read])).toEqual([
      ["n10", false],
      ["n13", false],
      ["n11", true],
      ["n12", true],
    ]);
    expect((await loadNotifications(DANA)).find((n) => n.id === "n1")?.read).toBe(false);
  });

  it("a rep can still mark their own row", async () => {
    mount(JORDAN);
    await flush();
    expect(await attempt("n10")).toBeUndefined();
    expect(isRead("n10")).toBe(true);
  });

  it.each(["coach", "viewer"] as const)("%s cannot mark any row", async (role) => {
    mount({ ...DANA, role });
    await flush();
    expect(await attempt("n1")).toBe("NOTIFICATION_NOT_FOUND");
    expect(await attempt("n10")).toBe("NOTIFICATION_NOT_FOUND");
    expect((await loadNotifications(DANA)).find((n) => n.id === "n1")?.read).toBe(false);
  });

  it("mark all: a denied id doesn't affect the others", async () => {
    mount(JORDAN);
    await flush();
    await act(async () => {
      await Promise.allSettled(["n10", "n1", "n13"].map((id) => probe.mark.mutateAsync(id)));
    });
    expect(isRead("n10")).toBe(true);
    expect(isRead("n13")).toBe(true);
    expect((await loadNotifications(DANA)).find((n) => n.id === "n1")?.read).toBe(false);
  });
});

describe("rows of a type that isn't designed are left out (LANE_REQUESTS F-2)", () => {
  /** Live data today: legacy `new_lead` only. */
  const lead = (id: string, over: Partial<(typeof db)[number]> = {}) => ({
    id,
    type: "new_lead",
    message: "New lead: Acme Logistics",
    read: false,
    created_at: new Date().toISOString(),
    ...over,
  });
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    useSource("real");
    resetUnknownTypeWarnings();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("the mapper returns null for new_lead, and every designed type still maps to itself", () => {
    expect(mapNotificationRow(lead("l1"))).toBeNull();
    expect(mapNotificationRow(lead("l2", { type: "" }))).toBeNull();
    expect(mapNotificationRow(lead("l3", { type: null as never }))).toBeNull();
    for (const n of NOTIFICATIONS) {
      const row = mapNotificationRow({ ...lead(n.id), type: n.type, message: n.title });
      expect(row).toMatchObject({ id: n.id, type: n.type, title: n.title });
      expect(row?.typeLabel).toBe(n.typeLabel); // not rewritten to REPORT READY
    }
  });

  it("a new_lead row is not returned, and the designed rows around it are", async () => {
    db.splice(2, 0, lead("lead_1"), lead("lead_2", { read: true }));
    const rows = await loadNotifications(DANA);
    expect(rows.map((n) => n.id)).toEqual(NOTIFICATIONS.map((n) => n.id));
  });

  it("a designed type is still returned on its own", async () => {
    db = [lead("r1", { type: "report_ready", message: "Daily Manager Brief" })];
    expect(await loadNotifications(DANA)).toMatchObject([{ id: "r1", type: "report_ready" }]);
  });

  it("counts ignore dropped rows", async () => {
    db.push(lead("lead_1"), lead("lead_2"), lead("lead_3"));
    mount(DANA);
    await flush();
    expect(cached().map((n) => n.id)).toEqual(NOTIFICATIONS.map((n) => n.id));
    expect(counts(cached()).all).toBe(9);
    expect(counts(cached())).toEqual(counts(await loadNotifications(DANA)));
  });

  it("the bell dot ignores dropped rows: only an unread designed row lights it", async () => {
    db = [lead("lead_1"), lead("lead_2")];
    mount(DANA);
    await flush();
    expect(cached()).toEqual([]);
    expect(probe.dot).toBe(false); // two unread leads, no dot

    unmount();
    db = [lead("lead_1"), lead("r_read", { type: "report_ready", read: true })];
    mount(DANA);
    await flush();
    expect(cached().map((n) => n.id)).toEqual(["r_read"]);
    expect(probe.dot).toBe(false); // the only designed row is read

    unmount();
    db = [lead("lead_1", { read: true }), lead("r_new", { type: "report_ready" })];
    mount(DANA);
    await flush();
    expect(probe.dot).toBe(true);
  });

  it("dev: one warning per unknown raw type, not per row and not per load", async () => {
    db.push(
      lead("a1"),
      lead("a2"),
      lead("a3"),
      lead("m1", { type: "mystery" }),
      lead("m2", { type: "mystery" }),
      lead("n1", { type: null as never }),
    );
    await loadNotifications(DANA);
    await loadNotifications(DANA); // a refetch: still no new line
    expect(warn).toHaveBeenCalledTimes(3);
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('"new_lead"'))).toBe(true);
    expect(lines.some((l) => l.includes('"mystery"'))).toBe(true);
    expect(lines.some((l) => l.includes('"(null)"'))).toBe(true);
    expect(lines.every((l) => l.includes("F-2"))).toBe(true);
  });

  it("dev: a designed type never warns", async () => {
    await loadNotifications(DANA); // the nine designed rows
    expect(warn).not.toHaveBeenCalled();
  });

  it("not in dev: no warning, the row is still left out", async () => {
    vi.stubEnv("DEV", false);
    db.push(lead("lead_1"));
    expect((await loadNotifications(DANA)).map((n) => n.id)).not.toContain("lead_1");
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("useMarkNotificationRead — real mode", () => {
  beforeEach(() => {
    useSource("real");
    mount(DANA);
  });

  it("flips at once, before the write returns, then refetches", async () => {
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const write = deferred();
    markMock.mockImplementationOnce(() => write.promise);
    act(() => probe.mark.mutate("n1"));
    await flush();
    expect(isRead("n1")).toBe(true); // write still in flight
    expect(counts(cached()).needsYou).toBe(2);
    expect(probe.dot).toBe(true);
    db.find((r) => r.id === "n1")!.read = true;
    write.resolve();
    await flush();
    expect(markMock).toHaveBeenCalledWith("n1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isRead("n1")).toBe(true);
  });

  it("rolls the row back when the write fails, before the refetch lands", async () => {
    await flush();
    const refetch = deferred();
    const write = deferred();
    markMock.mockImplementationOnce(() => write.promise);
    act(() => probe.mark.mutate("n1"));
    await flush();
    expect(isRead("n1")).toBe(true);
    fetchMock.mockImplementationOnce(
      async () => (await refetch.promise, db.map((r) => ({ ...r }))),
    );
    write.reject(new Error("rls"));
    await flush();
    expect(probe.mark.error?.message).toBe("rls");
    expect(isRead("n1")).toBe(false); // cache is the rolled-back state; refetch hasn't returned
    expect(counts(cached()).needsYou).toBe(3);
    refetch.resolve();
    await flush();
    expect(isRead("n1")).toBe(false);
  });

  it("mark-all as parallel writes: one failure restores only its own row", async () => {
    await flush();
    const refetch = deferred();
    const ids = ["n1", "n2", "n3"];
    markMock.mockImplementation(async (id) => {
      if (id === "n2") throw new Error("rls");
      db.find((r) => r.id === id)!.read = true;
    });
    fetchMock.mockImplementation(async () => (await refetch.promise, db.map((r) => ({ ...r }))));
    // one hook instance, three overlapping mutations on different ids
    await act(async () => {
      await Promise.allSettled(ids.map((id) => probe.mark.mutateAsync(id)));
    });
    expect(isRead("n1")).toBe(true);
    expect(isRead("n2")).toBe(false);
    expect(isRead("n3")).toBe(true);
    expect(counts(cached()).needsYou).toBe(1);
    refetch.resolve();
    await flush();
    expect(counts(cached()).needsYou).toBe(1);
  });
});
