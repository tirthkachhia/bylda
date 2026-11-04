import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  level: {
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    isPending: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  list: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => state.level }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { mfa: { listFactors: state.list, challengeAndVerify: state.verify }, signOut: vi.fn() },
  },
}));
import { AuthenticatorGate } from "@/components/app/AuthenticatorGate";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  state.level.data = { currentLevel: "aal1", nextLevel: "aal2" };
  state.level.isPending = false;
  state.level.error = null;
  state.list.mockResolvedValue({
    data: { totp: [{ id: "verified-factor", status: "verified" }] },
    error: null,
  });
  state.verify.mockResolvedValue({ error: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render() {
  act(() =>
    root.render(
      <AuthenticatorGate>
        <div>Private workspace</div>
      </AuthenticatorGate>,
    ),
  );
}
describe("enrolled authenticator sign-in challenge", () => {
  it("withholds workspace contents until the session reaches the enrolled assurance level", () => {
    render();
    expect(host.textContent).toContain("Authenticator code");
    expect(host.textContent).not.toContain("Private workspace");
    state.level.data.currentLevel = "aal2";
    render();
    expect(host.textContent).toContain("Private workspace");
  });
  it("withholds workspace contents if security cannot be checked", () => {
    state.level.error = new Error("offline");
    render();
    expect(host.textContent).toContain("Security could not be checked");
    expect(host.textContent).not.toContain("Private workspace");
  });
  it("verifies against the enrolled factor and refreshes assurance before admitting the session", async () => {
    render();
    const input = host.querySelector("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "123456",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(state.verify).toHaveBeenCalledWith({ factorId: "verified-factor", code: "123456" });
    expect(state.level.refetch).toHaveBeenCalled();
    expect(host.textContent).not.toContain("Private workspace");
  });
});
