import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadBehaviorDetail,
  loadBehaviors,
  loadObjectionStats,
  loadPatterns,
  loadRepScores,
} from "../behaviors/hooks";
import { loadInvoices, loadPlan, loadUsage } from "../billing/hooks";
import {
  loadCallComparison,
  loadCallReview,
  loadCalls,
  loadMyCalls,
  loadSavedViews,
} from "../calls/hooks";
import {
  loadCoachingComments,
  loadCoachingFoci,
  loadCoachingFocus,
  loadMyCoaching,
} from "../coaching/hooks";
import type { DataCtx } from "../core/context";
import { setSourceOverride } from "../core/source";
import { loadHomeFeed, loadInsights, loadWorkspaceHealth } from "../insights/hooks";
import {
  loadDataSources,
  loadDeliveryChannels,
  loadIntegrationDetail,
} from "../integrations/hooks";
import {
  loadMethodologies,
  loadMethodology,
  loadObjectionLibrary,
  loadSuccessCriteria,
} from "../methodology/hooks";
import { loadNotifications } from "../notifications/hooks";
import { loadOnboarding } from "../onboarding/hooks";
import { loadOutcomeAssociations } from "../outcomes/hooks";
import { loadBrief, loadReports } from "../reports/hooks";
import {
  loadDmMessages,
  loadDmThreads,
  loadRoom,
  loadRoomMessages,
  loadRooms,
} from "../rooms/hooks";
import { loadPaletteItems, loadSearch } from "../search/hooks";
import { loadViewer } from "../session/hooks";
import {
  loadAnalysisPreferences,
  loadApiKeys,
  loadAuditLog,
  loadMembers,
  loadNotificationPreferences,
  loadProfile,
  loadRetentionPolicy,
  loadRoleDefinitions,
  loadWorkspaceSettings,
} from "../settings/hooks";
import { loadSidebar } from "../shell/hooks";
import {
  loadMyProgress,
  loadRepComparison,
  loadRepHome,
  loadRepSummary,
  loadTeam,
  loadTeamMembers,
} from "../team/hooks";
import { isOutcomeSufficient } from "../types";

/** Every adapter works in mock mode (VITE_BYLDA_MOCKS=true) — no network, deterministic. */
const DANA: DataCtx = {
  userId: "u_dana",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role: "manager",
};
const KIRAN: DataCtx = { ...DANA, userId: "u_kiran", role: "owner" };
const JORDAN: DataCtx = { ...DANA, userId: "u_jordan", role: "rep" };

beforeAll(() => setSourceOverride("mock"));
afterAll(() => setSourceOverride(null));

const nonEmpty: [string, () => Promise<unknown[]>][] = [
  ["calls", () => loadCalls(DANA)],
  ["my calls", () => loadMyCalls(JORDAN)],
  ["saved views", () => loadSavedViews(DANA)],
  ["behaviors", () => loadBehaviors(DANA)],
  ["rep scores", () => loadRepScores(DANA, "u_jordan")],
  ["patterns", () => loadPatterns(DANA)],
  ["objection stats", () => loadObjectionStats(DANA)],
  ["outcome associations", () => loadOutcomeAssociations(DANA)],
  ["insights", () => loadInsights(DANA)],
  ["coaching", () => loadCoachingFoci(DANA)],
  ["my coaching", () => loadMyCoaching(JORDAN)],
  ["coaching comments", () => loadCoachingComments(DANA, "cf_jordan_pause")],
  ["team members", () => loadTeamMembers(DANA, "team_mm")],
  ["reports", () => loadReports(DANA)],
  ["rooms", () => loadRooms(DANA)],
  ["room messages", () => loadRoomMessages(DANA, "room_objections")],
  ["dm threads", () => loadDmThreads(DANA)],
  ["dm messages", () => loadDmMessages(DANA, "dm_dana_jordan")],
  ["notifications", () => loadNotifications(DANA)],
  ["palette", () => loadPaletteItems(DANA, "")],
  ["data sources", () => loadDataSources(DANA)],
  ["delivery channels", () => loadDeliveryChannels(DANA)],
  ["members", () => loadMembers(DANA)],
  ["role definitions", () => loadRoleDefinitions()],
  ["api keys", () => loadApiKeys(KIRAN)],
  ["audit log", () => loadAuditLog(KIRAN)],
  ["methodologies", () => loadMethodologies(DANA)],
  ["objection library", () => loadObjectionLibrary()],
  ["success criteria", () => loadSuccessCriteria()],
  ["invoices", () => loadInvoices(KIRAN)],
  ["usage", () => loadUsage(KIRAN)],
];

describe("every list adapter returns rows in mock mode", () => {
  for (const [name, fn] of nonEmpty)
    it(name, async () => expect((await fn()).length).toBeGreaterThan(0));
});

describe("every single-object adapter resolves in mock mode", () => {
  it("viewer by role", async () => {
    for (const role of ["owner", "admin", "manager", "rep", "viewer", "coach"] as const) {
      const v = await loadViewer(
        "mock",
        { userId: null, name: null, email: null, orgId: null, orgName: null },
        role,
      );
      expect(v.role).toBe(role);
      expect(v.workspace?.name).toBe("Acme Revenue");
    }
  });
  it("call review / comparison", async () => {
    const r = await loadCallReview(DANA, "call_acme");
    expect(r?.transcript.length).toBeGreaterThan(0);
    expect(r?.events.length).toBeGreaterThan(0);
    expect(
      (await loadCallComparison(DANA, "call_acme", "call_brightline"))?.differences.length,
    ).toBeGreaterThan(0);
  });
  it("home feed / health", async () => {
    expect((await loadHomeFeed(DANA)).items.length).toBeGreaterThan(0);
    expect((await loadWorkspaceHealth(KIRAN)).sources.length).toBeGreaterThan(0);
  });
  it("behavior detail / coaching focus / brief / room / integration / methodology", async () => {
    expect(await loadBehaviorDetail(DANA, "interrupting_during_objections")).not.toBeNull();
    expect(await loadCoachingFocus(DANA, "cf_alex_pause")).not.toBeNull();
    expect((await loadBrief(DANA, "weekly_manager"))?.sections.length).toBeGreaterThan(0);
    expect(await loadRoom(DANA, "objection-watch")).not.toBeNull();
    expect((await loadIntegrationDetail(KIRAN, "hubspot"))?.mappings.length).toBeGreaterThan(0);
    expect(await loadMethodology(DANA, "meth_meddic")).not.toBeNull();
  });
  it("team / rep summary / comparison / rep home / progress", async () => {
    expect((await loadTeam(DANA, "team_mm"))?.repIds).toHaveLength(9);
    expect((await loadRepSummary(DANA, "u_jordan"))?.leaks.length).toBeGreaterThan(0);
    expect((await loadRepComparison(DANA, "team_mm")).rows.length).toBeGreaterThan(0);
    expect((await loadRepHome(JORDAN))?.focus).not.toBeNull();
    expect((await loadMyProgress(JORDAN)).foci.length).toBeGreaterThan(0);
  });
  it("search turns the question into filter chips, results link to calls", async () => {
    const res = await loadSearch(DANA, "Jordan price objections");
    expect(res.filters.map((f) => f.field)).toEqual(expect.arrayContaining(["rep", "objection"]));
    expect(res.results.every((r) => r.callId.startsWith("call_"))).toBe(true);
  });
  it("settings / billing / onboarding singletons", async () => {
    expect((await loadWorkspaceSettings(DANA)).name).toBe("Acme Revenue");
    expect((await loadProfile(DANA)).name).toBe("Dana Whitfield");
    expect((await loadAnalysisPreferences(DANA)).minCallSeconds).toBeGreaterThan(0);
    expect((await loadNotificationPreferences(DANA)).channel).toBeTruthy();
    expect((await loadRetentionPolicy(DANA)).recordingsDays).toBe(90);
    expect((await loadPlan(KIRAN)).tier).toBeTruthy();
    expect((await loadOnboarding(DANA)).analysis.total).toBeGreaterThan(0);
  });
  it("mock data exercises the page-17 states: one call per status, one n<30 outcome, one low-confidence insight", async () => {
    const statuses = new Set((await loadCalls(DANA)).map((c) => c.status));
    expect([...statuses].sort()).toEqual(["failed", "partial", "processing", "ready"]);
    expect((await loadOutcomeAssociations(DANA)).some((o) => !isOutcomeSufficient(o))).toBe(true);
    const gated = await loadInsights(DANA);
    expect(
      gated.some(
        (g) => g.state === "insight" && g.insight.confidence === "low" && g.insight.action === null,
      ),
    ).toBe(true);
    expect(gated.some((g) => g.state === "insufficient")).toBe(true);
  });
  it("sidebar lists", async () => {
    const s = await loadSidebar(DANA);
    expect(s.rooms.length).toBeGreaterThan(0);
    expect(s.people.length).toBeGreaterThan(0);
  });
});
