import { describe, it, expect, beforeEach } from "vitest";
import { resolveStepForRun, buildRunMomentum, type MissionLoopStep } from "@/lib/mission-loop";
import { extractAndSaveProfileFromFields, factsToPartialProfile } from "@/lib/workspaceProfile";

const steps: MissionLoopStep[] = [
  {
    id: "s1",
    title: "Build a GTM plan",
    tool_key: "gtm-strategy",
    status: "completed",
    sort_order: 0,
  },
  {
    id: "s2",
    title: "Create your pitch",
    tool_key: "pitch-generator",
    status: "pending",
    sort_order: 1,
  },
  { id: "s3", title: "Write your ICP", tool_key: null, status: "pending", sort_order: 2 },
];

describe("resolveStepForRun", () => {
  it("resolves an explicit stepId when the step is still open", () => {
    expect(resolveStepForRun(steps, { stepId: "s2", toolKeys: [] })?.id).toBe("s2");
  });

  it("refuses an explicit stepId that is already completed (no double-complete)", () => {
    expect(resolveStepForRun(steps, { stepId: "s1", toolKeys: ["gtm-strategy"] })).toBeNull();
  });

  it("falls back to matching the first open step by tool key", () => {
    const hit = resolveStepForRun(steps, { toolKeys: ["pitch-generator", "generate-pitch"] });
    expect(hit?.id).toBe("s2");
  });

  it("matches either the catalog slug or the edge tool key", () => {
    const bySlug = resolveStepForRun(steps, { toolKeys: ["pitch-generator"] });
    expect(bySlug?.id).toBe("s2");
  });

  it("returns null when the run's tool matches no open step", () => {
    expect(resolveStepForRun(steps, { toolKeys: ["seo-audit"] })).toBeNull();
    // gtm-strategy step exists but is already completed
    expect(resolveStepForRun(steps, { toolKeys: ["gtm-strategy"] })).toBeNull();
  });

  it("never matches manual steps (tool_key null) by tool key", () => {
    expect(resolveStepForRun(steps, { toolKeys: [""] })).toBeNull();
  });

  it("treats 'done' and 'skipped' as closed statuses", () => {
    const s: MissionLoopStep[] = [
      { id: "a", title: "A", tool_key: "followup", status: "done", sort_order: 0 },
      { id: "b", title: "B", tool_key: "followup", status: "skipped", sort_order: 1 },
      { id: "c", title: "C", tool_key: "followup", status: "in_progress", sort_order: 2 },
    ];
    expect(resolveStepForRun(s, { toolKeys: ["followup"] })?.id).toBe("c");
  });

  it("matches steps through the lesson-vocabulary aliases", () => {
    const s: MissionLoopStep[] = [
      {
        id: "f10",
        title: "First 10",
        tool_key: "first-10-customers",
        status: "pending",
        sort_order: 0,
      },
      { id: "fu", title: "Follow-up", tool_key: "followup", status: "pending", sort_order: 1 },
      { id: "gtm", title: "GTM", tool_key: "gtm-strategy", status: "pending", sort_order: 2 },
    ];
    // A run of the curriculum-named tool completes the step-named step.
    expect(resolveStepForRun(s, { toolKeys: ["first-10-customers-finder"] })?.id).toBe("f10");
    expect(resolveStepForRun(s, { toolKeys: ["email-sequence"] })?.id).toBe("fu");
    expect(resolveStepForRun(s, { toolKeys: ["gtm-strategy-builder"] })?.id).toBe("gtm");
  });

  it("alias matching still refuses closed steps", () => {
    const s: MissionLoopStep[] = [
      {
        id: "f10",
        title: "First 10",
        tool_key: "first-10-customers",
        status: "completed",
        sort_order: 0,
      },
    ];
    expect(resolveStepForRun(s, { toolKeys: ["first-10-customers-finder"] })).toBeNull();
  });

  it("already-aligned keys (offer, kpi-dashboard) match without an alias", () => {
    const s: MissionLoopStep[] = [
      { id: "o", title: "Offer", tool_key: "offer", status: "pending", sort_order: 0 },
      { id: "k", title: "KPIs", tool_key: "kpi-dashboard", status: "pending", sort_order: 1 },
    ];
    expect(resolveStepForRun(s, { toolKeys: ["offer"] })?.id).toBe("o");
    expect(resolveStepForRun(s, { toolKeys: ["kpi-dashboard"] })?.id).toBe("k");
  });
});

describe("buildRunMomentum", () => {
  it("counts the just-completed step and surfaces the next open step", () => {
    const m = buildRunMomentum("Go to Market", steps, "s2");
    expect(m.stepTitle).toBe("Create your pitch");
    expect(m.completedCount).toBe(2);
    expect(m.totalSteps).toBe(3);
    expect(m.missionCompleted).toBe(false);
    expect(m.nextStep?.id).toBe("s3");
  });

  it("maps the next step's tool_key to its tool route", () => {
    const s: MissionLoopStep[] = [
      { id: "s1", title: "First", tool_key: "gtm-strategy", status: "pending", sort_order: 0 },
      { id: "s2", title: "Second", tool_key: "pitch-generator", status: "pending", sort_order: 1 },
    ];
    const m = buildRunMomentum("Mission", s, "s1");
    expect(m.nextStep?.toolRoute).toBe("/app/launchpad/pitch-generator");
  });

  it("gives a null toolRoute for manual next steps", () => {
    const m = buildRunMomentum("Go to Market", steps, "s2");
    expect(m.nextStep?.toolRoute).toBeNull();
  });

  it("flags the mission complete when the last open step finishes", () => {
    const s: MissionLoopStep[] = [
      { id: "s1", title: "First", tool_key: "gtm-strategy", status: "completed", sort_order: 0 },
      { id: "s2", title: "Last", tool_key: "pitch-generator", status: "pending", sort_order: 1 },
    ];
    const m = buildRunMomentum("Mission", s, "s2");
    expect(m.missionCompleted).toBe(true);
    expect(m.nextStep).toBeNull();
    expect(m.completedCount).toBe(2);
  });
});

describe("extractAndSaveProfileFromFields — learned facts", () => {
  beforeEach(() => localStorage.clear());

  it("returns the facts a run taught Bylda", () => {
    const facts = extractAndSaveProfileFromFields({
      startupName: "Acme",
      targetCustomer: "dentists in Texas",
    });
    expect(facts).toContainEqual({ label: "Business name", value: "Acme" });
    expect(facts).toContainEqual({ label: "Target market", value: "dentists in Texas" });
  });

  it("only reports facts that are new or changed", () => {
    extractAndSaveProfileFromFields({ startupName: "Acme" });
    const again = extractAndSaveProfileFromFields({ startupName: "Acme" });
    expect(again).toEqual([]);
    const changed = extractAndSaveProfileFromFields({ startupName: "Acme Corp" });
    expect(changed).toEqual([{ label: "Business name", value: "Acme Corp" }]);
  });
});

describe("factsToPartialProfile", () => {
  it("maps fact labels back to profile keys for the server sync", () => {
    expect(
      factsToPartialProfile([
        { label: "Business name", value: "Acme" },
        { label: "Target market", value: "dentists" },
        { label: "Revenue model", value: "subscriptions" },
      ]),
    ).toEqual({ business_name: "Acme", target_market: "dentists", revenue_model: "subscriptions" });
  });

  it("drops unknown labels instead of guessing", () => {
    expect(factsToPartialProfile([{ label: "Favorite color", value: "purple" }])).toEqual({});
  });

  it("round-trips what extractAndSaveProfileFromFields learned", () => {
    localStorage.clear();
    const facts = extractAndSaveProfileFromFields({ targetCustomer: "SaaS founders" });
    expect(factsToPartialProfile(facts)).toEqual({ target_market: "SaaS founders" });
  });
});
