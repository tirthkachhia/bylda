import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  data: { totalCalls: 3, calls: [], runs: [], events: [] },
  error: null as Error | null,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ currentOrgId: "org" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({ repsQuery: () => ({ queryKey: ["reps"] }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: (q: { queryKey: string[] }) => ({
    isPending: false,
    error: q.queryKey[0] === "workspace-intelligence" ? state.error : null,
    data: q.queryKey[0] === "workspace-intelligence" ? state.data : [],
    refetch: vi.fn(),
  }),
}));
import { WorkspaceInsights } from "../../components/app/coaching/WorkspaceInsights";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
  state.data = { totalCalls: 3, calls: [], runs: [], events: [] };
  state.error = null;
});
describe("Insights call-source state", () => {
  it("recognizes uploaded calls without requiring an integration", () => {
    act(() => root.render(<WorkspaceInsights />));
    expect(host.textContent).toContain("3 calls are already saved");
    expect(host.textContent).not.toContain("Connect a source");
    expect(host.textContent).toContain("Review saved calls");
  });
  it("offers upload and connection only for a truly empty workspace", () => {
    state.data.totalCalls = 0;
    act(() => root.render(<WorkspaceInsights />));
    expect(host.textContent).toContain("No calls in this workspace yet");
    expect(host.textContent).toContain("Upload calls");
    expect(host.textContent).toContain("Connect a source");
  });
  it("does not treat a failed evidence query as an empty workspace", () => {
    state.error = new Error("network");
    act(() => root.render(<WorkspaceInsights />));
    expect(host.textContent).toContain("Workspace evidence could not load");
    expect(host.textContent).not.toContain("No calls in this workspace");
    expect(host.textContent).not.toContain("Connect a source");
  });
});
