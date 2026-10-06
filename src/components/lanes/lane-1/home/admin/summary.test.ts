import { describe, expect, it } from "vitest";
import type { CoachingFocus, DataSource, Member, Pattern, Person, TeamSummary } from "@/lib/data";
import {
  callsTile,
  checklistFor,
  crossTeamPattern,
  focusAckTile,
  headlineFor,
  needsYou,
  sourcesTile,
  teamsTile,
} from "./summary";

const src = (o: Partial<DataSource> & Pick<DataSource, "key" | "name">): DataSource => ({
  category: "dialer",
  status: "connected",
  lastSyncAt: "2026-09-27T12:00:00Z",
  callsSynced: 0,
  waiting: 0,
  error: null,
  ...o,
});
const health = (alerts: { id: string; title: string }[] = []) => ({
  sources: [],
  failedJobs: 0,
  callsAnalyzedThisWeek: 0,
  seats: { used: 0, total: null },
  alerts: alerts.map((a) => ({ ...a, severity: "regress" as const })),
});

describe("headlineFor", () => {
  it.each([
    [
      { broken: 1, unsetTeams: 1 },
      "Bylda is running. One thing is broken, and one team isn’t set up.",
    ],
    [
      { broken: 2, unsetTeams: 3 },
      "Bylda is running. Two things are broken, and three teams aren’t set up.",
    ],
    [{ broken: 1, unsetTeams: 0 }, "Bylda is running. One thing is broken."],
    [{ broken: 0, unsetTeams: 2 }, "Bylda is running. Two teams aren’t set up."],
    [{ broken: 12, unsetTeams: 0 }, "Bylda is running. 12 things are broken."],
    [
      { broken: 0, unsetTeams: 0 },
      "Bylda is running. Everything is connected and every team is set up.",
    ],
  ])("%j", (counts, expected) => expect(headlineFor(counts)).toBe(expected));
});

describe("sourcesTile", () => {
  it("counts connected of tracked; `not_connected` catalog entries don't count", () => {
    const t = sourcesTile([
      src({ key: "zoom", name: "Zoom" }),
      src({ key: "aircall", name: "Aircall", status: "error" }),
      src({ key: "gong", name: "Gong", status: "not_connected" }),
    ]);
    expect(t).toMatchObject({ connected: 1, total: 2 });
    expect(t.broken.map((s) => s.name)).toEqual(["Aircall"]);
  });
});

describe("teamsTile", () => {
  it("separates set-up teams from teams still in setup", () => {
    const teams: TeamSummary[] = [
      { id: "a", name: "Mid-Market AE", repCount: 9, status: "active", short: "MM" },
      { id: "s", name: "SDR", repCount: 0, status: "setup", short: "SD" },
    ];
    expect(teamsTile(teams)).toMatchObject({ active: 1, total: 2 });
    expect(teamsTile(teams).unset.map((t) => t.name)).toEqual(["SDR"]);
  });
});

describe("callsTile", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const call = (startedAt: string, status: "ready" | "processing") =>
    ({ startedAt, status }) as never;
  it("counts the last 7 days and the analyzed share; null share when there are no calls", () => {
    const t = callsTile(
      [
        call("2026-09-30T00:00:00Z", "ready"),
        call("2026-09-29T00:00:00Z", "ready"),
        call("2026-09-28T00:00:00Z", "processing"),
        call("2026-09-01T00:00:00Z", "ready"), // too old
      ],
      now,
    );
    expect(t).toEqual({ total: 3, analyzedPct: 67 });
    expect(callsTile([], now)).toEqual({ total: 0, analyzedPct: null });
  });
});

describe("focusAckTile", () => {
  const f = (assignedAt: string, acknowledgedAt: string | null) =>
    ({ assignedAt, acknowledgedAt }) as CoachingFocus;
  it("counts focuses acknowledged within 24h of assignment, out of all assigned", () => {
    expect(
      focusAckTile([
        f("2026-09-29T10:00:00Z", "2026-09-29T12:00:00Z"), // 2h  ✓
        f("2026-09-29T10:00:00Z", "2026-09-30T10:00:00Z"), // 24h ✓ (boundary)
        f("2026-09-29T10:00:00Z", "2026-09-30T10:00:01Z"), // 24h+1s ✗
        f("2026-09-29T10:00:00Z", null), //                  ✗
      ]),
    ).toEqual({ within24h: 2, total: 4 });
  });
});

describe("needsYou", () => {
  const aircall = src({ key: "aircall", name: "Aircall", status: "error", waiting: 23 });
  it("uses the alert text, adds the waiting count, and links the alert to its source by name", () => {
    const [item] = needsYou(health([{ id: "al1", title: "Aircall stopped syncing on Sep 27" }]), [
      aircall,
    ]);
    expect(item.title).toBe("Aircall stopped syncing on Sep 27. 23 calls are waiting.");
    expect(item.source?.key).toBe("aircall");
  });
  it("surfaces a broken source even when there is no alert (alerts are empty until C-31)", () => {
    const items = needsYou(health(), [aircall]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe(
      "Aircall stopped syncing — last sync Sep 27. 23 calls are waiting.",
    );
  });
  it("doesn't double-report a source an alert already covers", () => {
    expect(needsYou(health([{ id: "al1", title: "Aircall is down" }]), [aircall])).toHaveLength(1);
  });
  it("is empty when nothing is broken", () => {
    expect(needsYou(health(), [src({ key: "zoom", name: "Zoom" })])).toEqual([]);
  });
});

describe("crossTeamPattern", () => {
  const people = [
    { id: "r1", teamId: "mm" },
    { id: "r2", teamId: "mm" },
    { id: "r3", teamId: "ent" },
  ] as Person[];
  const pat = (id: string, reps: string[], n: number, scope: Pattern["scope"] = "team") =>
    ({ id, scope, affectedRepIds: reps, sampleSize: n }) as Pattern;
  it("picks the strongest team pattern spanning 2+ teams; ignores single-team and non-team scopes", () => {
    const picked = crossTeamPattern(
      [
        pat("one-team", ["r1", "r2"], 99),
        pat("a", ["r1", "r3"], 10),
        pat("b", ["r2", "r3"], 40),
        pat("o", ["r1", "r3"], 500, "outcome"),
      ],
      people,
    );
    expect(picked?.id).toBe("b");
  });
  it("is null when no pattern spans teams", () => {
    expect(crossTeamPattern([pat("x", ["r1", "r2"], 50)], people)).toBeNull();
  });
});

describe("checklistFor", () => {
  const member = (role: Member["role"], status: Member["status"] = "active") =>
    ({ role, status }) as Member;
  const input = {
    methodologies: [{ name: "MEDDIC", isActive: true }] as never,
    sources: [
      src({ key: "zoom", name: "Zoom", category: "meetings" }),
      src({ key: "gong", name: "Gong", category: "recorder" }),
      src({ key: "hubspot", name: "HubSpot", category: "crm" }),
      src({ key: "aircall", name: "Aircall", status: "error" }),
    ],
    members: [member("manager"), member("rep")],
    channels: [{ key: "slack", status: "connected" }] as never,
    teams: [{ id: "s", name: "SDR", status: "setup" }] as never,
  };
  it("lists what's done first, then what's left, with names from the data", () => {
    const items = checklistFor(input);
    expect(items.map((i) => `${i.done ? "✓" : "○"} ${i.label}`)).toEqual([
      "✓ Workspace created",
      "✓ Methodology: MEDDIC",
      "✓ Zoom + Gong connected",
      "✓ HubSpot connected",
      "✓ Invite managers",
      "✓ Invite reps",
      "✓ Slack delivery",
      "○ Set up SDR team",
      "○ Reconnect Aircall",
    ]);
    expect(items.filter((i) => i.done)).toHaveLength(7);
  });
  it("marks missing setup as not done, and ignores disabled members", () => {
    const items = checklistFor({
      ...input,
      methodologies: [],
      members: [member("manager", "disabled")],
      channels: [],
      sources: [],
      teams: [],
    });
    const done = Object.fromEntries(items.map((i) => [i.id, i.done]));
    expect(done).toMatchObject({
      methodology: false,
      calls: false,
      crm: false,
      managers: false,
      reps: false,
      slack: false,
    });
  });
});
