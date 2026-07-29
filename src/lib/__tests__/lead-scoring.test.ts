import { describe, it, expect } from "vitest";
import { computeLeadScore, scoreLeadDetailed } from "@/lib/lead-scoring";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("computeLeadScore", () => {
  it("scores an empty contact at 0", () => {
    expect(computeLeadScore({}, NOW)).toBe(0);
  });

  it("adds points for contactability and company link", () => {
    expect(computeLeadScore({ email: "a@b.com" }, NOW)).toBe(15);
    expect(computeLeadScore({ email: "a@b.com", phone: "+1" }, NOW)).toBe(25);
    expect(computeLeadScore({ email: "a@b.com", phone: "+1", company: "Acme" }, NOW)).toBe(35);
    expect(computeLeadScore({ company_id: "uuid" }, NOW)).toBe(10);
  });

  it("weights status", () => {
    expect(computeLeadScore({ status: "new" }, NOW)).toBe(5);
    expect(computeLeadScore({ status: "engaged" }, NOW)).toBe(40);
    expect(computeLeadScore({ status: "archived" }, NOW)).toBe(0);
    expect(computeLeadScore({ status: "UNKNOWN" }, NOW)).toBe(0);
  });

  it("rewards recent contact in buckets", () => {
    const base = { status: "new" as const }; // 5 baseline
    expect(computeLeadScore({ ...base, last_contacted_at: "2026-06-13T12:00:00Z" }, NOW)).toBe(25); // <=7d +20
    expect(computeLeadScore({ ...base, last_contacted_at: "2026-05-25T12:00:00Z" }, NOW)).toBe(15); // <=30d +10
    expect(computeLeadScore({ ...base, last_contacted_at: "2026-04-01T12:00:00Z" }, NOW)).toBe(10); // <=90d +5
    expect(computeLeadScore({ ...base, last_contacted_at: "2025-01-01T12:00:00Z" }, NOW)).toBe(5); // old +0
  });

  it("caps tag points and rewards high-intent tags", () => {
    expect(computeLeadScore({ tags: ["a", "b", "c", "d", "e", "f"] }, NOW)).toBe(15); // capped
    expect(computeLeadScore({ tags: ["hot"] }, NOW)).toBe(13); // 3 + 10 intent
  });

  it("clamps to 100 for a maxed-out contact", () => {
    expect(
      computeLeadScore(
        {
          email: "a@b.com",
          phone: "+1",
          company: "Acme",
          status: "engaged",
          last_contacted_at: NOW.toISOString(),
          tags: ["hot", "ready", "demo"],
        },
        NOW,
      ),
    ).toBe(100);
  });

  it("returns reasons in the detailed breakdown", () => {
    const out = scoreLeadDetailed({ email: "a@b.com", status: "qualified" }, NOW);
    expect(out.score).toBe(45);
    expect(out.reasons).toContain("Has email (+15)");
    expect(out.reasons.some((r) => r.includes("qualified"))).toBe(true);
  });
});
