import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Search } from "lucide-react";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Logo } from "@/components/brand/Logo";
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
    if (loading || user) return;
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
  const canvasHome = path === "/app" || path === "/app/";
  if (canvasHome) {
    return (
      <div className="h-screen overflow-hidden bg-[#f7f9fd] text-[#111318]">
        <Outlet />
      </div>
    );
  }
  return (
    <div className="flex h-screen overflow-hidden bg-[#eeefeb] text-[#17191e]">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-black/[0.08] bg-[#f8f8f5] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#737982] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/app/crm/calls" className="lg:hidden">
              <Logo showWordmark={false} markClassName="h-8 w-8" />
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[11px] text-[#8a8f96] md:flex">
              <Search className="h-3.5 w-3.5" />
              <span className="w-44">Search calls, deals, people</span>
              <kbd className="rounded border border-black/[0.09] bg-[#f6f6f2] px-1.5 py-0.5 font-mono text-[8px]">
                ⌘ K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-[10px] font-medium text-[#6d737b] sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#42bb79]" />
              Sources connected
            </div>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.09] bg-white text-[#6e747d]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
