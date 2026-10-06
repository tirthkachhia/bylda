import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSource, setSourceOverride } from "../core/source";
import { loadSavedViews } from "../calls/hooks";
import { loadCoachingFoci } from "../coaching/hooks";
import { loadPlan } from "../billing/hooks";
import type { DataCtx } from "../core/context";

const ctx: DataCtx = {
  userId: "actual-user",
  orgId: null,
  workspaceId: null,
  teamId: null,
  role: "owner",
};
afterEach(() => {
  setSourceOverride(null);
  vi.unstubAllEnvs();
});
describe("production integration", () => {
  it("requires explicit demo mode before returning fixture-only domains", () => {
    vi.stubEnv("VITE_BYLDA_MOCKS", "false");
    expect(resolveSource("mock")).toBe("real");
    expect(resolveSource("hybrid")).toBe("hybrid");
  });
  it("keeps demo mode available explicitly", () => {
    vi.stubEnv("VITE_BYLDA_MOCKS", "true");
    expect(resolveSource("real")).toBe("mock");
  });
  it("returns no fixture saved views in normal use", async () => {
    vi.stubEnv("VITE_BYLDA_MOCKS", "false");
    expect(await loadSavedViews(ctx)).toEqual([]);
  });
  it("reports missing coaching instead of sample coaching", async () => {
    vi.stubEnv("VITE_BYLDA_MOCKS", "false");
    await expect(loadCoachingFoci(ctx)).rejects.toMatchObject({ code: "NOT_BUILT" });
  });
  it("doesn't fabricate a paid plan for users without a workspace", async () => {
    vi.stubEnv("VITE_BYLDA_MOCKS", "false");
    await expect(loadPlan(ctx)).rejects.toThrow("Select a workspace");
  });
  it("rejects billing for every non-admin role", async () => {
    setSourceOverride("mock");
    for (const role of ["manager", "coach", "viewer", "rep"] as const) {
      await expect(loadPlan({ ...ctx, role })).rejects.toMatchObject({
        code: "FORBIDDEN_FOR_ROLE",
      });
    }
  });
});
