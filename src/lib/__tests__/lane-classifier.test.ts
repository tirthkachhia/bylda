import { describe, it, expect } from "vitest";
import { classifyLane, LANE_META } from "@/lib/lane-classifier";

describe("classifyLane", () => {
  it("maps operating founders with product/fundraising to Systems", () => {
    expect(classifyLane("Scale", "fundraising")).toBe("Systems");
    expect(classifyLane("Operate", "product")).toBe("Systems");
  });

  it("maps Launch-stage fundraising to Systems", () => {
    expect(classifyLane("Launch", "fundraising")).toBe("Systems");
  });

  it("maps revenue-stage growth to Customer", () => {
    expect(classifyLane("Launch", "customers")).toBe("Customer");
    expect(classifyLane("Scale", "marketing")).toBe("Customer");
  });

  it("maps validating builders to Offer", () => {
    expect(classifyLane("Validate", "product")).toBe("Offer");
  });

  it("maps early-stage to Idea", () => {
    expect(classifyLane("Idea", "product")).toBe("Idea");
  });

  it("falls back to Idea for unknown input", () => {
    expect(classifyLane("", "")).toBe("Idea");
    expect(classifyLane("Nonsense", "whatever")).toBe("Idea");
  });

  it("has metadata for every lane", () => {
    for (const lane of ["Idea", "Offer", "Customer", "Systems"] as const) {
      expect(LANE_META[lane]).toBeDefined();
      expect(LANE_META[lane].label.length).toBeGreaterThan(0);
    }
  });
});
