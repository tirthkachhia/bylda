import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ForbiddenForRoleError, setSourceOverride, type DataCtx } from "@/lib/data";
import { loadBehaviorDetail } from "@/lib/data/behaviors/hooks";
import type { BehaviorDetail } from "@/lib/data";
import { BehaviorDetailView } from "../I2BehaviorDetailInterruptingDuringObjections";
import { RepsAffected } from "./RepsAffected";

// The context panel portals into the shell; SSR has no shell, so render it inline.
vi.mock("@/components/bylda", async () => ({
  ...(await vi.importActual<object>("@/components/bylda")),
  ContextPanel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));

const ctx = (role: DataCtx["role"]): DataCtx => ({
  userId: role === "rep" ? "u_jordan" : "u_dana",
  orgId: "org_acme",
  workspaceId: "ws_acme",
  teamId: "team_mm",
  role,
});

beforeAll(() => setSourceOverride("mock"));
afterAll(() => setSourceOverride(null));

const idle = { data: undefined, isLoading: false, error: null, isEmpty: false };

describe("Behavior Detail — reps affected is manager-only", () => {
  it("resolves pause_after_objection for a manager, with the by-rep list", async () => {
    const d = await loadBehaviorDetail(ctx("manager"), "pause_after_objection");
    expect(d?.behavior.key).toBe("pause_after_objection");
    expect(d?.byRep.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown id (screen renders the error state)", async () => {
    expect(await loadBehaviorDetail(ctx("manager"), "nope")).toBeNull();
  });

  it("refuses a rep at the data layer", async () => {
    await expect(loadBehaviorDetail(ctx("rep"), "pause_after_objection")).rejects.toBeInstanceOf(
      ForbiddenForRoleError,
    );
  });

  it("a rep's view renders no rep names and no by-rep section", async () => {
    const full = (await loadBehaviorDetail(
      ctx("manager"),
      "pause_after_objection",
    )) as BehaviorDetail;
    const html = renderToString(
      <BehaviorDetailView
        detail={{ ...idle, error: new ForbiddenForRoleError("team behavior detail", "rep") }}
        outcomes={idle}
        behaviorKey="pause_after_objection"
      />,
    );
    expect(html).toContain("Restricted");
    expect(html).not.toContain("BY REP");
    for (const r of full.byRep) expect(html).not.toContain(r.repName);
  });

  it("the by-rep list names every rep for a manager", async () => {
    const full = (await loadBehaviorDetail(
      ctx("manager"),
      "pause_after_objection",
    )) as BehaviorDetail;
    const html = renderToString(<RepsAffected detail={full} />);
    for (const r of full.byRep) expect(html).toContain(r.repName);
  });

  it("an unknown id shows the error state", () => {
    const html = renderToString(
      <BehaviorDetailView
        detail={{ ...idle, data: null, isEmpty: true }}
        outcomes={idle}
        behaviorKey="nope"
      />,
    );
    expect(html).toContain("doesn’t have a behavior called that");
  });
});

describe("Behavior Detail — loaded view", () => {
  const render = async (full: BehaviorDetail) => {
    const root = createRootRoute({
      component: () => (
        <BehaviorDetailView
          detail={{ ...idle, data: full }}
          outcomes={{ ...idle, data: [], isEmpty: true }}
          behaviorKey={full.behavior.key}
        />
      ),
    });
    const router = createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();
    return renderToString(<RouterProvider router={router} />);
  };

  it("renders the manager view with the four Figma items", async () => {
    const full = (await loadBehaviorDetail(
      ctx("manager"),
      "interrupting_during_objections",
    )) as BehaviorDetail;
    const html = await render(full);
    expect(html).toContain("Interrupting during objections");
    expect(html).toMatch(/38(<!-- -->)? \/ (<!-- -->)?142/);
    expect(html).toContain("4 of 9");
    expect(html).toContain("2 above baseline");
    expect(html).toContain("EXAMPLE TO AVOID");
    expect(html).toContain("EXAMPLE TO COPY");
    expect(html).toContain(full.recommendedChange as string);
    expect(html).toContain("AFFECTED CALLS");
    expect(html).toContain('stroke-dasharray="4 4"'); // projection comes from data
    for (const e of full.evidence) expect(html).toContain(`href="/app/calls/${e.callId}"`);
    for (const r of full.byRep) expect(html).toContain(r.repName);
  });

  it("degrades when the new fields are absent (observation only, no examples)", async () => {
    const full = (await loadBehaviorDetail(
      ctx("manager"),
      "pause_after_objection",
    )) as BehaviorDetail;
    const html = await render(full);
    expect(html).not.toContain("EXAMPLE TO AVOID");
    expect(html).not.toContain("AFFECTED CALLS");
    expect(html).toContain("No recommended change");
  });

  it("a rep-role view renders none of the manager-only names, accounts or examples", async () => {
    const full = (await loadBehaviorDetail(
      ctx("manager"),
      "interrupting_during_objections",
    )) as BehaviorDetail;
    const html = renderToString(
      <BehaviorDetailView
        detail={{ ...idle, error: new ForbiddenForRoleError("team behavior detail", "rep") }}
        outcomes={idle}
        behaviorKey="interrupting_during_objections"
      />,
    );
    for (const r of full.byRep) expect(html).not.toContain(r.repName);
    for (const c of full.affectedCalls) expect(html).not.toContain(c.account);
    expect(html).not.toContain("EXAMPLE TO");
    expect(html).not.toContain("AFFECTED CALLS");
  });

  it("the data layer refuses a rep before any new field is built", async () => {
    await expect(
      loadBehaviorDetail(ctx("rep"), "interrupting_during_objections"),
    ).rejects.toBeInstanceOf(ForbiddenForRoleError);
  });
});
