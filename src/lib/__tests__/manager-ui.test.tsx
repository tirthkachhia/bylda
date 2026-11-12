import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  permission: { data: true, isPending: false, isError: false },
  invite: vi.fn(),
  invalidate: vi.fn(),
  toast: vi.fn(),
  signIn: vi.fn(),
  configure: vi.fn(),
  brief: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useRouterState: () => undefined,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => state.permission,
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ currentOrgId: "org", user: { id: "manager" } }),
}));
vi.mock("@/lib/queries", () => ({ coachingManagerPermissionQuery: vi.fn() }));
vi.mock("@/components/app/TodayBrief", () => ({
  TodayBrief: () => {
    state.brief();
    return <div>Team intelligence</div>;
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword: state.signIn } },
}));
vi.mock("@/lib/manager-access", () => ({ configureLoginWorkspace: state.configure }));
vi.mock("@/lib/invokeEdge", () => ({ invokeEdge: state.invite }));
vi.mock("sonner", () => ({ toast: { success: state.toast, error: state.toast } }));
import { ManagerAgents } from "@/components/app/coaching/ManagerAgents";
import { SignIn } from "@/routes/auth.sign-in";
import { Route } from "@/routes/app.manager";
const ManagerHome = Route.options.component as ComponentType;
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
beforeEach(() => {
  vi.clearAllMocks();
  state.permission = { data: true, isPending: false, isError: false };
  state.invite.mockResolvedValue({ status: "invited" });
});
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
});
function fill(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
const teams = [
  {
    id: "team",
    organization_id: "org",
    name: "Sales",
    manager_id: "manager",
    rep_ids: [],
    playbook_id: null,
    updated_at: "now",
  },
];
it("requires a team before an agent can be added", () => {
  act(() => root.render(<ManagerAgents organizationId="org" teams={[]} />));
  expect(host.textContent).toContain("Create your team first");
  expect(host.querySelector("form")).toBeNull();
});
it("adds an agent to the selected team and refreshes the team and rep views", async () => {
  act(() => root.render(<ManagerAgents organizationId="org" teams={teams} />));
  fill(host.querySelectorAll("input")[0], "Jane Agent");
  fill(host.querySelectorAll("input")[1], "jane@example.com");
  await submit();
  expect(state.invite).toHaveBeenCalledWith(
    "team-invite",
    {
      organizationId: "org",
      teamId: "team",
      name: "Jane Agent",
      email: "jane@example.com",
      role: "member",
    },
    { retries: 0 },
  );
  expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["reps", "org"] });
  expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["coaching-teams", "org"] });
  expect(host.querySelectorAll("input")[1].value).toBe("");
});
it("preserves input and reports a failed agent invitation", async () => {
  state.invite.mockRejectedValue(new Error("Agent belongs to another manager"));
  act(() => root.render(<ManagerAgents organizationId="org" teams={teams} />));
  fill(host.querySelectorAll("input")[0], "Jane");
  fill(host.querySelectorAll("input")[1], "jane@example.com");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("another manager");
  expect(host.querySelectorAll("input")[1].value).toBe("jane@example.com");
  expect(state.invalidate).not.toHaveBeenCalled();
});
it("does not render manager data while access is pending or denied", () => {
  state.permission = { data: false, isPending: true, isError: false };
  act(() => root.render(<ManagerHome />));
  expect(host.textContent).toContain("Checking manager access");
  expect(state.brief).not.toHaveBeenCalled();
  state.permission = { data: false, isPending: false, isError: false };
  act(() => root.render(<ManagerHome />));
  expect(host.textContent).toContain("Manager access required");
  expect(state.brief).not.toHaveBeenCalled();
});
it("opens the existing team dashboard for verified managers", () => {
  act(() => root.render(<ManagerHome />));
  expect(host.textContent).toContain("Team intelligence");
});
it("checks the authenticated account's manager membership before redirecting", async () => {
  state.signIn.mockResolvedValue({ data: { user: { id: "agent" } }, error: null });
  state.configure.mockRejectedValue(new Error("This account has no manager access"));
  act(() => root.render(<SignIn manager />));
  expect(host.querySelector("h1")?.textContent).toBe("Manager sign in");
  fill(host.querySelector('input[type="email"]')!, "agent@example.com");
  fill(host.querySelector('input[type="password"]')!, "password123");
  await submit();
  expect(state.configure).toHaveBeenCalledWith("agent", true);
  expect(state.toast).toHaveBeenCalledWith("This account has no manager access");
});
