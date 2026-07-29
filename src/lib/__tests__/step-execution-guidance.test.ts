import { describe, it, expect } from "vitest";
import { getStepGuidance, makeFallbackGuidance, TOOL_ROUTES } from "@/lib/step-execution-guidance";

describe("getStepGuidance", () => {
  it("returns guidance for a known create-mode tool", () => {
    const g = getStepGuidance("idea-validator");
    expect(g).not.toBeNull();
    expect(g?.directions.length).toBe(3);
    expect(g?.doneWhen.length).toBeGreaterThan(0);
  });

  it("resolves alias keys", () => {
    expect(getStepGuidance("gtm-strategy-builder")?.stepId).toBe(
      getStepGuidance("gtm-strategy")?.stepId,
    );
  });

  it("now has guidance for the BYLDA (operate/scale) tools", () => {
    for (const key of [
      "kpi-dashboard",
      "seo-audit",
      "launch-checklist",
      "email-sequence",
      "ad-copy",
    ]) {
      const g = getStepGuidance(key);
      expect(g, `missing guidance for ${key}`).not.toBeNull();
      expect(g?.directions.length).toBe(3);
      expect(g?.toolRoute).toBe(TOOL_ROUTES[key]);
    }
  });

  it("returns null for unknown or empty keys", () => {
    expect(getStepGuidance("not-a-real-tool")).toBeNull();
    expect(getStepGuidance(null)).toBeNull();
  });
});

describe("makeFallbackGuidance", () => {
  it("produces a tool-routed fallback when a route exists", () => {
    const g = makeFallbackGuidance("Do the thing", "desc", "idea-validator");
    expect(g.toolRoute).toBe(TOOL_ROUTES["idea-validator"]);
    expect(g.directions.length).toBe(3);
  });

  it("produces a manual fallback when there is no route", () => {
    const g = makeFallbackGuidance("Manual step", null, null);
    expect(g.toolRoute).toBeNull();
    expect(g.buttonLabel.toLowerCase()).toContain("mark it done");
  });
});
