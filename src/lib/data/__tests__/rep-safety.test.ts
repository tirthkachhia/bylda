import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { navFor, newMenuFor, REP_FORBIDDEN_PREFIXES } from "@/components/bylda/shell/nav";
import { loadCallReview, loadCalls, loadMyCalls } from "../calls/hooks";
import { loadCoachingFoci, loadCoachingFocus } from "../coaching/hooks";
import type { DataCtx } from "../core/context";
import { setSourceOverride } from "../core/source";
import {
  loadBehaviorDetail,
  loadObjectionStats,
  loadPatterns,
  loadRepScores,
} from "../behaviors/hooks";
import { loadHomeFeed, loadInsights } from "../insights/hooks";
import { loadOutcomeAssociations } from "../outcomes/hooks";
import { loadBrief, loadReports } from "../reports/hooks";
import { loadDmMessages } from "../rooms/hooks";
import { loadPaletteItems, loadSearch } from "../search/hooks";
import { loadMembers } from "../settings/hooks";
import { loadSidebar } from "../shell/hooks";
import {
  loadRepComparison,
  loadRepHome,
  loadRepSummary,
  loadTeam,
  loadTeamMembers,
} from "../team/hooks";

/**
 * CLAUDE.md §4: "Reps never see peer comparisons or team rankings." There is NO
 * backend guarantee (RLS on calls is org-wide), so the data layer enforces it.
 * Jordan Reyes is the rep; Alex Morgan and Sarah Lin are his peers.
 */
const JORDAN: DataCtx = {
  userId: "u_jordan",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "rep",
};
const PEER = "u_alex";

beforeAll(() => setSourceOverride("mock"));
afterAll(() => setSourceOverride(null));

describe("rep-scoped hooks return only the rep's own data", () => {
  it("calls: only Jordan's, even when a peer or no filter is asked for", async () => {
    for (const filter of [{}, { repId: PEER }, { teamId: "team_mm" }]) {
      const calls = await loadCalls(JORDAN, filter);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((c) => c.repId === "u_jordan")).toBe(true);
    }
    expect((await loadMyCalls(JORDAN)).every((c) => c.repId === "u_jordan")).toBe(true);
  });

  it("call review: a peer's call is FORBIDDEN (renders Y9)", async () => {
    await expect(loadCallReview(JORDAN, "call_kestrel")).rejects.toThrow(/FORBIDDEN_FOR_ROLE/);
    expect((await loadCallReview(JORDAN, "call_acme"))?.call.repId).toBe("u_jordan");
  });

  it("coaching: only Jordan's focuses; a peer's focus is forbidden", async () => {
    const all = await loadCoachingFoci(JORDAN, { repId: PEER });
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((c) => c.repId === "u_jordan")).toBe(true);
    await expect(loadCoachingFocus(JORDAN, "cf_alex_pause")).rejects.toThrow(/FORBIDDEN_FOR_ROLE/);
  });

  it("insights: only insights about Jordan alone", async () => {
    const ins = (await loadInsights(JORDAN)).flatMap((g) =>
      g.state === "insight" ? [g.insight] : [],
    );
    expect(ins.length).toBeGreaterThan(0);
    expect(
      ins.every((i) => i.affectedRepIds.length === 1 && i.affectedRepIds[0] === "u_jordan"),
    ).toBe(true);
  });

  it("scores / summary / home / members: always Jordan, whoever is asked for", async () => {
    await loadRepScores(JORDAN, PEER); // resolves to Jordan's own scores
    expect((await loadRepSummary(JORDAN, PEER))?.rep.id).toBe("u_jordan");
    expect((await loadRepHome(JORDAN))?.rep.id).toBe("u_jordan");
    expect((await loadTeamMembers(JORDAN, "team_mm")).map((p) => p.id)).toEqual(["u_jordan"]);
  });

  it("reports: only his own rep briefs; a team brief is forbidden", async () => {
    const reports = await loadReports(JORDAN);
    expect(reports.every((r) => r.kind === "daily_rep" || r.kind === "weekly_rep")).toBe(true);
    await expect(loadBrief(JORDAN, "rep_weekly_39")).rejects.toThrow(/FORBIDDEN_FOR_ROLE/);
  });

  it("search + palette: only his calls, no people or patterns", async () => {
    const res = await loadSearch(JORDAN, "Alex price objections");
    expect(res.results.every((r) => r.repName === "Jordan Reyes")).toBe(true);
    const items = await loadPaletteItems(JORDAN, "");
    expect(items.every((i) => i.kind === "call")).toBe(true);
  });

  it("DMs: another pair's DM is forbidden", async () => {
    await expect(loadDmMessages(JORDAN, "dm_dana_kiran")).rejects.toThrow(/FORBIDDEN_FOR_ROLE/);
  });

  it("sidebar: no PEOPLE list for a rep", async () => {
    expect((await loadSidebar(JORDAN)).people).toEqual([]);
  });
});

describe("peer / team-wide data is refused to a rep", () => {
  const refused: [string, () => Promise<unknown>][] = [
    ["rep comparison (T13)", () => loadRepComparison(JORDAN, "team_mm")],
    ["manager home feed (H1)", () => loadHomeFeed(JORDAN)],
    ["team view (T1–T7)", () => loadTeam(JORDAN, "team_mm")],
    ["behavior detail (I2)", () => loadBehaviorDetail(JORDAN, "pause_after_objection")],
    ["patterns (I3)", () => loadPatterns(JORDAN)],
    ["objection stats (I4)", () => loadObjectionStats(JORDAN)],
    ["outcome associations (I5)", () => loadOutcomeAssociations(JORDAN)],
    ["member list (E3)", () => loadMembers(JORDAN)],
  ];
  for (const [what, fn] of refused) {
    it(what, async () => {
      await expect(fn()).rejects.toThrow(/FORBIDDEN_FOR_ROLE/);
    });
  }
});

describe("rep nav never links to leaderboard / comparison / team views", () => {
  it("primary + bottom nav", () => {
    const nav = navFor("rep", "u_jordan");
    const hrefs = [...nav.primary, ...nav.bottom].map((i) => i.to);
    for (const h of hrefs)
      for (const bad of REP_FORBIDDEN_PREFIXES)
        expect(h.startsWith(bad), `${h} starts with ${bad}`).toBe(false);
    expect(nav.primary.map((i) => i.key)).not.toContain("team");
    expect(nav.primary.map((i) => i.key)).not.toContain("intelligence");
  });
  it("+ New menu", () => {
    expect(newMenuFor("rep").map((i) => i.key)).not.toContain("coach");
  });
  it("a manager DOES get team + intelligence", () => {
    const keys = navFor("manager", "u_dana").primary.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["team", "intelligence", "coaching"]));
  });
});
