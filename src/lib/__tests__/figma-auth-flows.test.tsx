import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  verify: vi.fn(),
  resend: vi.fn(),
  signup: vi.fn(),
  email: "owner@example.invalid",
  complete: false,
  owner: "owner",
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({ email: state.email }),
  }),
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { verifyOtp: state.verify, resend: state.resend, signUp: state.signup } },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "owner" },
    currentOrgId: "auto-org",
    currentOrg: { owner_id: state.owner },
    profile: { onboarding_complete: state.complete },
    refreshProfile: vi.fn(),
    loading: false,
  }),
}));
vi.mock("@/lib/invokeEdge", () => ({ invokeEdge: vi.fn() }));
import { Route as VerifyRoute } from "../../routes/auth.verify-email";
import { Route as SignupRoute } from "../../routes/auth.sign-up";
import { Route as SetupRoute } from "../../routes/onboarding";
const Verify = VerifyRoute.options.component as ComponentType;
const Signup = SignupRoute.options.component as ComponentType;
const Setup = SetupRoute.options.component as ComponentType;
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
beforeEach(() => {
  vi.clearAllMocks();
  state.email = "owner@example.invalid";
  state.complete = false;
  state.owner = "owner";
  state.resend.mockResolvedValue({ error: null });
  state.verify.mockResolvedValue({ data: { session: {} }, error: null });
  state.signup.mockResolvedValue({ data: { session: null }, error: null });
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
it("keeps owner setup available when signup already provisioned an organization", () => {
  act(() => root.render(<Setup />));
  expect(host.querySelector("form")).not.toBeNull();
  expect(host.textContent).not.toContain("Your workspace is ready.");
});
it("does not offer workspace provisioning to an invited non-owner", () => {
  state.owner = "someone-else";
  act(() => root.render(<Setup />));
  expect(host.querySelector("form")).toBeNull();
  expect(host.textContent).toContain("Your workspace is ready.");
});
it("sends unconfirmed signups to the Figma verification screen", async () => {
  act(() => root.render(<Signup />));
  const inputs = [...host.querySelectorAll("input")];
  fill(inputs[0], "New owner");
  fill(inputs[1], "owner@example.invalid");
  fill(inputs[2], "a-long-password");
  await submit();
  expect(state.signup).toHaveBeenCalledWith(
    expect.objectContaining({ email: "owner@example.invalid" }),
  );
  expect(state.navigate).toHaveBeenCalledWith({
    to: "/auth/verify-email",
    search: { email: "owner@example.invalid" },
  });
  expect(inputs[2].placeholder).toContain("12");
});
it("verifies the entered code through existing auth and continues to setup", async () => {
  act(() => root.render(<Verify />));
  fill(host.querySelector("input")!, "123456");
  await submit();
  expect(state.verify).toHaveBeenCalledWith({ email: state.email, token: "123456", type: "email" });
  expect(state.navigate).toHaveBeenCalledWith({ to: "/onboarding" });
});
it("shows verification errors without advancing", async () => {
  state.verify.mockResolvedValue({ data: { session: null }, error: new Error("Expired code") });
  act(() => root.render(<Verify />));
  fill(host.querySelector("input")!, "123456");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Expired code");
  expect(state.navigate).not.toHaveBeenCalled();
});
it("resends using signup confirmation and prevents repeated clicks during cooldown", async () => {
  act(() => root.render(<Verify />));
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Resend email",
  )!;
  await act(async () => button.click());
  expect(state.resend).toHaveBeenCalledWith(
    expect.objectContaining({ type: "signup", email: state.email }),
  );
  expect(button.disabled).toBe(true);
  expect(button.textContent).toBe("Resend in 1:00");
});
it("requires an email before verifying or resending", () => {
  state.email = "";
  act(() => root.render(<Verify />));
  expect(host.querySelector("input")!.disabled).toBe(true);
  expect([...host.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
});
