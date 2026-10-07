import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { useEffect } from "react";
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
        Loading your workspace…
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
