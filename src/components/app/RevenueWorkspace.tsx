import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { LogOut, Menu, Settings, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/lib/auth";
import { guestStore } from "@/lib/guest";
import { integrationsQuery } from "@/lib/queries";
import { clearLastAppPath } from "@/lib/session-restore";

const navigation = [
  ["Today", "/app"],
  ["Conversations", "/app/crm/calls"],
  ["Deal memory", "/app/memory"],
  ["Accounts", "/app/contacts"],
  ["Forecast", "/app/bylda/reports"],
  ["Integrations", "/app/integrations"],
  ["CRM intelligence", "/app/crm/setup"],
] as const;

export function RevenueWorkspace({ children }: { children: ReactNode }) {
  const { user, currentOrg, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const connections = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const connected = connections.data?.filter((item) => item.is_connected).length ?? 0;
  async function logout() {
    setLeaving(true);
    try {
      await signOut();
      guestStore.disable();
      clearLastAppPath();
      queryClient.clear();
      await navigate({ to: "/auth/sign-in", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out. Please retry.");
    } finally {
      setLeaving(false);
    }
  }
  return (
    <div className="light revenue-workspace min-h-screen bg-[#fafafa] text-[#242424]">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:block focus:p-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#fafafa]/95 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[1600px] items-center gap-6 px-5 lg:px-10">
          <Link to="/app" aria-label="Bylda home">
            <Logo markClassName="h-8 w-8" />
          </Link>
          <nav
            aria-label="Workspace"
            className="hidden flex-1 flex-wrap justify-center gap-x-5 gap-y-2 py-4 xl:flex"
          >
            {navigation.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                aria-current={
                  path.replace(/\/$/, "") === to.replace(/\/$/, "") ? "page" : undefined
                }
                className="text-xs text-neutral-500 transition hover:text-black aria-[current=page]:font-semibold aria-[current=page]:text-black"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/app/integrations" className="hidden text-[11px] text-neutral-500 sm:block">
              {connections.isError
                ? "Connection check failed"
                : connections.isPending
                  ? "Checking sources…"
                  : `${connected} sources connected`}
            </Link>
            <Link
              to="/app/settings"
              aria-label="Settings"
              className="rounded-full border border-black/10 p-2 hover:bg-neutral-100"
            >
              <Settings size={16} />
            </Link>
            <button
              onClick={logout}
              disabled={leaving}
              className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs disabled:opacity-50"
            >
              <LogOut size={14} />
              {leaving ? "Signing out…" : "Sign out"}
            </button>
            <button
              className="p-2 xl:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="workspace-navigation"
            aria-label="Mobile workspace"
            className="grid grid-cols-2 gap-2 border-t border-black/5 p-4 xl:hidden"
          >
            {navigation.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="rounded-lg p-3 text-sm hover:bg-neutral-100"
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main
        id="workspace-content"
        className="mx-auto max-w-[1600px] px-4 pb-28 pt-6 sm:px-8 lg:px-12"
      >
        {children}
      </main>
      <div className="fixed bottom-5 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 rounded-full border border-black/10 bg-white px-5 py-3 shadow-lg shadow-black/5">
        <Link to="/app/memory" className="flex items-center gap-3 whitespace-nowrap text-sm">
          <Sparkles size={16} />
          Ask Bylda{" "}
          <span className="hidden text-xs text-neutral-400 sm:inline">
            Explore your connected data
          </span>
        </Link>
        <span className="hidden max-w-36 truncate border-l border-black/10 pl-4 text-[10px] text-neutral-400 md:inline">
          {currentOrg?.name || "Your workspace"}
        </span>
      </div>
    </div>
  );
}
