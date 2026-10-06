import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/bylda/shell/AppShell";
import { StateLoading } from "@/components/bylda";
import { mocksForced } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { saveLastAppPath } from "@/lib/session-restore";

/**
 * /app — the authed layout. Every /app/* route (V1 screens AND the quarantined legacy
 * routes) renders inside the Bylda V1 shell (CLAUDE.md §12 B).
 * FROZEN once the foundation PR merges (§12 A).
 *
 * VITE_BYLDA_MOCKS=true skips the sign-in guard: the shell renders for the mock viewer
 * (Dana Whitfield, manager — switch with ?as=rep or the profile menu). Dev/demo only.
 */
export const Route = createFileRoute("/app")({
  component: ProtectedAppLayout,
});

function ProtectedAppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const mock = mocksForced();

  useEffect(() => {
    // Guard only what this layout guards. While the redirect below is in flight, the router's
    // latest location is already /auth/sign-in but this layout is still mounted; without this
    // check the guard re-ran there, took the sign-in URL as the page to return to, and
    // redirected again — each pass wrapping the last URL in `?redirect=` until React gave up.
    const inApp = location.pathname === "/app" || location.pathname.startsWith("/app/");
    if (mock || loading || user || !inApp) return;
    const redirectTo = `${location.pathname}${location.searchStr}${location.hash}`;
    void navigate({
      to: "/auth/sign-in",
      search: { redirect: redirectTo } as never,
      replace: true,
    });
  }, [mock, loading, location.hash, location.pathname, location.searchStr, navigate, user]);

  if (!mock && (loading || !user)) {
    return (
      <div className="bylda flex min-h-screen items-center justify-center p-6">
        <StateLoading label="LOADING YOUR WORKSPACE" />
      </div>
    );
  }

  return <AppLayout />;
}

function AppLayout() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    saveLastAppPath(path);
  }, [path]);
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
