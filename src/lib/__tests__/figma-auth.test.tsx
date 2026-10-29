import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  listener: null as null | ((event: string, session: unknown) => void),
  delay: null as null | Promise<void>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      onAuthStateChange: (listener: typeof state.listener) => {
        state.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (state.delay) await state.delay;
          return {
            data:
              table === "profiles"
                ? { id: "real-user", full_name: "Real member", email: "real@example.invalid" }
                : {
                    organization_id: "real-org",
                    organizations: { id: "real-org", name: "Real workspace" },
                  },
            error: null,
          };
        },
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
  state.delay = null;
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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(host.textContent).toBe("real-user / real-org");
  expect(guestStore.get().isGuest).toBe(false);
});

it("does not restore a signed-out user's workspace from an in-flight profile read", async () => {
  let release!: () => void;
  state.delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.session = { user: { id: "real-user", email: "real@example.invalid" } };
  await act(async () =>
    root.render(
      <AuthProvider>
        <Identity />
      </AuthProvider>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  act(() => state.listener!("SIGNED_OUT", null));
  await act(async () => {
    release();
  });
  expect(host.textContent).toBe("signed-out / no-org");
});
it("loads membership after signing in without reloading the page", async () => {
  await act(async () =>
    root.render(
      <AuthProvider>
        <Identity />
      </AuthProvider>,
    ),
  );
  act(() =>
    state.listener!("SIGNED_IN", { user: { id: "real-user", email: "real@example.invalid" } }),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(host.textContent).toBe("real-user / real-org");
});
