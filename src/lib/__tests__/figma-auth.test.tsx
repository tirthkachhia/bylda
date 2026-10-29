import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({
          data:
            table === "profiles"
              ? { id: "real-user", full_name: "Real member", email: "real@example.invalid" }
              : {
                  organization_id: "real-org",
                  organizations: { id: "real-org", name: "Real workspace" },
                },
          error: null,
        }),
      };
      return q;
    },
  },
}));
import { AuthProvider, useAuth } from "../auth";
import { guestStore } from "../guest";
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
function Identity() {
  const auth = useAuth();
  return (
    <div>
      {auth.user?.id ?? "signed-out"} / {auth.currentOrgId ?? "no-org"}
    </div>
  );
}
beforeEach(() => {
  state.session = null;
  guestStore.enable();
});
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(host);
  guestStore.disable();
});
it("does not turn retired guest state into an authenticated MVP user", async () => {
  await act(async () =>
    root.render(
      <AuthProvider>
        <Identity />
      </AuthProvider>,
    ),
  );
  expect(host.textContent).toBe("signed-out / no-org");
  expect(guestStore.get().isGuest).toBe(false);
});
it("uses only the real session and membership when retired guest state exists", async () => {
  state.session = { user: { id: "real-user", email: "real@example.invalid" } };
  await act(async () =>
    root.render(
      <AuthProvider>
        <Identity />
      </AuthProvider>,
    ),
  );
  expect(host.textContent).toBe("real-user / real-org");
  expect(guestStore.get().isGuest).toBe(false);
});
