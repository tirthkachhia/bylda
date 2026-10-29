import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ seek: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ currentOrgId: "org", profile: { full_name: "Dana" } }),
}));
vi.mock("@/lib/guest", () => ({
  useGuest: () => ({ isGuest: false }),
  guestStore: { get: () => ({ isGuest: false }) },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({
  managerHomeQuery: () => ({ queryKey: ["home"] }),
  repsQuery: () => ({ queryKey: ["reps"] }),
  callScoresQuery: () => ({ queryKey: ["scores"] }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (q: { queryKey: string[] }) => ({
    isPending: false,
    data:
      q.queryKey[0] === "home"
        ? {
            insights: [],
            reports: [
              {
                id: "report",
                rep_id: "rep",
                status: "completed",
                report: { headline: "Saved report is visible" },
              },
            ],
            calls: [],
            recentCallIds: [],
            importedCalls: 0,
            analyzedCalls: 0,
          }
        : q.queryKey[0] === "scores"
          ? {
              rows: [
                { exchange_index: 0, start_s: null },
                { exchange_index: 1, start_s: 0 },
              ],
              moments: [
                { id: "a", exchange_index: 0, headline: "Unknown timing" },
                { id: "b", exchange_index: 1, headline: "Starts at zero" },
              ],
            }
          : [],
  }),
}));
import { TodayBrief } from "../../components/app/TodayBrief";
import { CallScores } from "../../components/app/coaching/CallScores";
import { Inactive } from "../../components/app/FigmaPrimitives";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
  state.seek.mockClear();
});
describe("Figma MVP support boundaries", () => {
  it("renders saved reports when the insight feed is empty", () => {
    act(() => root.render(<TodayBrief />));
    expect(host.textContent).toContain("Saved report is visible");
    expect(host.textContent).toContain("View report");
    expect(host.textContent).not.toContain("Let’s get Bylda ready");
  });
  it("preserves unknown legacy moment times and wires genuine zero", () => {
    act(() => root.render(<CallScores callId="call" onSeek={state.seek} />));
    const buttons = [...host.querySelectorAll("button")];
    const unknown = buttons.find((b) => b.textContent === "Time unknown")!;
    const zero = buttons.find((b) => b.textContent === "0:00")!;
    expect(unknown.disabled).toBe(true);
    expect(zero.disabled).toBe(false);
    act(() => zero.click());
    expect(state.seek).toHaveBeenCalledWith(0);
  });
  it("renders unsupported Figma controls with no active behavior", () => {
    act(() => root.render(<Inactive>Assign coaching</Inactive>));
    const b = host.querySelector("button")!;
    expect(b.disabled).toBe(true);
    expect(b.dataset.unavailable).toBe("true");
    expect(b.title).toBe("Not available yet");
  });
});
