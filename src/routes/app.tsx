import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { LiveWorkspaceShell } from "@/components/app/LiveWorkspaceShell";

import { useAuth } from "@/lib/auth";
import { saveLastAppPath } from "@/lib/session-restore";

export const Route = createFileRoute("/app")({
  component: ProtectedAppLayout,
});

function ProtectedAppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const [slowSession, setSlowSession] = useState(false);
  useEffect(() => {
    if (!loading) { setSlowSession(false); return; }
    const timer = setTimeout(() => setSlowSession(true), 15000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading || user || !/^\/app(?:\/|$)/.test(location.pathname)) return;
    const redirectTo = `${location.pathname}${location.searchStr}${location.hash}`;
    void navigate({
      to: "/auth/sign-in",
      search: { redirect: redirectTo } as never,
      replace: true,
    });
  }, [loading, location.hash, location.pathname, location.searchStr, navigate, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fd] text-sm text-[#6d737b]">
        {slowSession ? (
          <div className="max-w-sm space-y-4 p-6 text-center">
            <h1 className="text-lg font-semibold">Your session is taking longer than expected</h1>
            <p>We have not loaded your workspace yet. Retry the connection, or open sign-in to recover your session.</p>
            <button className="rounded border px-4 py-2" onClick={() => window.location.reload()}>Retry connection</button>
            <Link className="block underline" to="/auth/sign-in">Open sign-in</Link>
          </div>
        ) : "Loading your workspace…"}
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
    <LiveWorkspaceShell>
      <Outlet />
    </LiveWorkspaceShell>
  );
}
