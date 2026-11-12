import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  userId: "owner",
  allowed: true,
  pending: false,
  failed: false,
  queries: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: state.userId },
    currentOrgId: "org",
    currentOrg: { name: "Workspace" },
    profile: { full_name: "Owner" },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/queries", () => ({
  integrationsQuery: () => ({ queryKey: ["integrations"] }),
  repsQuery: () => ({ queryKey: ["reps"] }),
  playbooksQuery: () => ({ queryKey: ["playbooks"] }),
  organizationMembersQuery: () => ({ queryKey: ["members"] }),
  coachingManagerPermissionQuery: () => ({ queryKey: ["permission"] }),
}));
vi.mock("@/lib/coaching/workspace", () => ({
  teamsQuery: () => ({ queryKey: ["teams"] }),
  saveTeam: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
  useQuery: (q: { queryKey: unknown[]; enabled?: boolean }) => {
    state.queries(q);
    return q.queryKey[0] === "permission"
      ? {
          data: state.pending ? undefined : state.allowed,
          isPending: state.pending,
          isError: state.failed,
          refetch: vi.fn(),
        }
      : { data: [], isPending: false };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/app", search: {} } }),
}));
vi.mock("@/components/app/FigmaPageViews", () => ({
  FigmaPageBrowser: () => null,
  FigmaViewLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/app/WorkspacePicker", () => ({ WorkspacePicker: () => null }));
import { WorkspaceViewProvider, useWorkspaceView } from "../workspace-view";
import {
  setWorkspaceView,
  readWorkspaceView,
  clearWorkspaceView,
  startAgentOAuth,
} from "../workspace-view-session";
import { LiveWorkspaceShell } from "@/components/app/LiveWorkspaceShell";
import { CallList } from "@/components/app/coaching/CallList";
import { WorkspaceTeams } from "@/components/app/coaching/WorkspaceTeams";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
function Screen() {
  const view = useWorkspaceView();
  return (
    <LiveWorkspaceShell>
      <WorkspaceTeams />
      <span data-view={view}>{view}</span>
      <CallList calls={[]} selectedId={null} onSelect={vi.fn()} search="" onSearch={vi.fn()} />
    </LiveWorkspaceShell>
  );
}
function render() {
  act(() =>
    root.render(
      <WorkspaceViewProvider>
        <Screen />
      </WorkspaceViewProvider>,
    ),
  );
}
beforeEach(() => {
  sessionStorage.clear();
  state.userId = "owner";
  state.allowed = true;
  state.pending = false;
  state.failed = false;
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
});

it("renders Page 30 for regular sign-in and keeps agent invitation behind manager sign-in", () => {
  setWorkspaceView("owner", "agent");
  render();
  expect(host.querySelector('[data-view="agent"]')).not.toBeNull();
  expect(host.querySelector(".page30-workspace")).not.toBeNull();
  expect(host.querySelector('[aria-label="Add an agent"]')).toBeNull();
  expect(host.querySelector('[aria-label="Calls list"]')?.className).toContain("page30-glass");
  expect(state.queries).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: ["permission"], enabled: false }),
  );
});
it("uses Page 30 for existing agent sessions", () => {
  render();
  expect(host.querySelector(".page30-workspace")).not.toBeNull();
});
it("allows agent invitations after manager login and role verification", () => {
  setWorkspaceView("owner", "manager");
  render();
  expect(host.querySelector('[data-view="manager"]')).not.toBeNull();
  expect(host.querySelector(".page30-workspace")).not.toBeNull();
  expect(host.querySelector('[aria-label="Add an agent"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Calls list"]')?.className).toContain("page30-glass");
});
it("keeps manager invitations inaccessible while manager access is pending or denied", () => {
  setWorkspaceView("owner", "manager");
  state.pending = true;
  render();
  expect(host.querySelector(".page30-workspace")).toBeNull();
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  state.pending = false;
  state.allowed = false;
  render();
  expect(host.querySelector(".page30-workspace")).not.toBeNull();
  expect(host.querySelector('[aria-label="Add an agent"]')).toBeNull();
});
it("does not carry a manager presentation across account changes", () => {
  setWorkspaceView("owner", "manager");
  render();
  state.userId = "agent";
  render();
  expect(host.querySelector(".page30-workspace")).not.toBeNull();
  expect(host.querySelector('[aria-label="Add an agent"]')).toBeNull();
  expect(host.querySelector('[data-view="agent"]')).not.toBeNull();
});
it("uses agent UI after agent OAuth even if the account previously used manager login", () => {
  setWorkspaceView("owner", "manager");
  startAgentOAuth();
  render();
  expect(readWorkspaceView("owner")).toBe("agent");
  expect(host.querySelector(".page30-workspace")).not.toBeNull();
  expect(host.querySelector('[aria-label="Add an agent"]')).toBeNull();
});
it("preserves the chosen view on reload and clears it on sign-out", () => {
  setWorkspaceView("owner", "manager");
  expect(readWorkspaceView("owner")).toBe("manager");
  expect(readWorkspaceView("someone-else")).toBe("agent");
  clearWorkspaceView("owner");
  expect(readWorkspaceView("owner")).toBe("agent");
});
