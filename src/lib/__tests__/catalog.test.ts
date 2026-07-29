import { describe, it, expect } from "vitest";
import { canAccessTool, getToolsByPhase, getToolsByCategory, LAUNCHPAD_TOOLS } from "@/lib/catalog";

describe("canAccessTool", () => {
  it("grants access when the user's plan is at or above the tool's plan", () => {
    expect(canAccessTool("0", "0")).toBe(true);
    expect(canAccessTool("149", "49")).toBe(true);
    expect(canAccessTool("299", "299")).toBe(true);
  });

  it("denies access when the user's plan is below the tool's plan", () => {
    expect(canAccessTool("0", "49")).toBe(false);
    expect(canAccessTool("49", "149")).toBe(false);
    expect(canAccessTool("149", "299")).toBe(false);
  });
});

describe("getToolsByPhase", () => {
  it("returns only main-path tools for a phase, sorted by step", () => {
    const phase1 = getToolsByPhase(1);
    expect(phase1.length).toBeGreaterThan(0);
    expect(phase1.every((t) => t.phase === 1 && t.step > 0)).toBe(true);
    const steps = phase1.map((t) => t.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it("excludes bonus tools (step 0)", () => {
    const all = [1, 2, 3, 4].flatMap((p) => getToolsByPhase(p as 1 | 2 | 3 | 4));
    expect(all.every((t) => t.step > 0)).toBe(true);
  });
});

describe("getToolsByCategory", () => {
  it("returns only tools in the requested category", () => {
    const validate = getToolsByCategory("validate");
    expect(validate.length).toBeGreaterThan(0);
    expect(validate.every((t) => t.category === "validate")).toBe(true);
  });

  it("every tool has a unique slug", () => {
    const slugs = LAUNCHPAD_TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
