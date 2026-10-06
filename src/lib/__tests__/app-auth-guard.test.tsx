import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/data", () => ({ mocksForced: () => false }));
vi.mock("@/lib/session-restore", () => ({ saveLastAppPath: () => {} }));
vi.mock("@/components/bylda/shell/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/bylda", () => ({ StateLoading: () => <div>loading</div> }));

import { Route as AppRoute } from "@/routes/app";

// React logs the "Maximum update depth" error before rethrowing; keep the output readable.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Regression: an unauthenticated visit to /app/* used to loop on /auth/sign-in, nesting the
 * URL in `?redirect=` ~50 levels deep until React threw "Maximum update depth exceeded".
 *
 * The guard lives in the /app layout, which stays mounted while the router transitions to the
 * sign-in route. During that window `state.location` is already /auth/sign-in; a guard that read
 * it re-fired and took the sign-in URL as the page to return to. The sign-in route here resolves
 * slowly on purpose — that is what opens the window (in the app it is a lazy-loaded chunk).
 */
describe("/app auth guard", () => {
  it("redirects an unauthenticated visitor to sign-in exactly once, preserving the target", async () => {
    const root = createRootRoute({ component: Outlet });
    const app = createRoute({
      getParentRoute: () => root,
      path: "/app",
      component: AppRoute.options.component,
    });
    const page = createRoute({
      getParentRoute: () => app,
      path: "/x",
      component: () => <div>page</div>,
    });
    const signIn = createRoute({
      getParentRoute: () => root,
      path: "/auth/sign-in",
      loader: () => new Promise<void>((resolve) => setTimeout(resolve, 40)),
      component: () => <div>sign-in</div>,
    });
    const router = createRouter({
      routeTree: root.addChildren([app.addChildren([page]), signIn]),
      history: createMemoryHistory({ initialEntries: ["/app/x?q=1"] }),
    });

    const el = document.createElement("div");
    const mount = createRoot(el);
    await act(async () => {
      mount.render(<RouterProvider router={router} />);
      await router.load();
    });
    // Let the slow sign-in route resolve and commit; poll rather than sleep.
    await vi.waitFor(
      async () => {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
        expect(el.textContent).toBe("sign-in");
      },
      { timeout: 3000, interval: 20 },
    );

    expect(router.state.location.pathname).toBe("/auth/sign-in");
    expect(router.state.location.href).toBe("/auth/sign-in?redirect=%2Fapp%2Fx%3Fq%3D1");
    await act(async () => mount.unmount());
  });
});
