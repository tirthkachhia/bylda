import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { guestStore } from "@/lib/guest";
import { integrationsQuery } from "@/lib/queries";
import { clearLastAppPath } from "@/lib/session-restore";
import { Wordmark } from "@/components/bylda/kit/ByldaGlyph";
import { SidebarItem } from "@/components/bylda/kit/SidebarItem";
import { Icon } from "@/components/bylda/kit/Icon";
import { workspaceNavigation } from "@/lib/workspace-navigation";

/** V1 presentation with original live routes. No mock adapters or auth bypass. */
export function LiveWorkspaceShell({ children }: { children: ReactNode }) {
  const { user, profile, currentOrg, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const connections = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const connected = connections.data?.filter((item) => item.is_connected).length ?? 0;
  const current = workspaceNavigation.find((item) => item.to === path.replace(/\/$/, ""));
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
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
  const sourceLabel = connections.isError
    ? "Connection check failed"
    : connections.isPending
      ? "Checking sources…"
      : `${connected} sources connected`;
  return (
    <div className="bylda light revenue-workspace v1-workspace flex h-dvh overflow-hidden bg-by-surface-canvas text-by-text-primary">
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-by-surface-raised focus:p-4"
      >
        Skip to content
      </a>
      <nav
        aria-label="Workspace rail"
        className="flex w-16 shrink-0 flex-col items-center gap-4 bg-by-surface-rail py-4 text-by-text-on-dark"
      >
        <Link
          to="/app"
          aria-label="Bylda home"
          className="type-brand-logo flex size-10 items-center justify-center rounded-by-card bg-by-surface-sidebar"
        >
          <img src="/bylda-logo.png" alt="" className="size-9 rounded-by-control object-contain" />
        </Link>
        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="workspace-navigation"
          onClick={() => setOpen(!open)}
          className="rounded-by-control p-2 min-[1025px]:hidden"
        >
          <Menu size={20} />
        </button>
        {workspaceNavigation
          .filter((item) => ["home", "calls", "memory", "integrations"].includes(item.key))
          .map((item) => (
            <Link
              key={item.key}
              to={item.to as never}
              aria-label={item.label}
              title={item.label}
              className="rounded-by-control p-2 text-by-text-on-dark-muted hover:bg-by-surface-sidebar-hover hover:text-by-text-on-dark"
            >
              <Icon name={item.icon} size={20} />
            </Link>
          ))}
        <Link to="/app/settings" aria-label="Settings" className="mt-auto rounded-by-control p-2">
          <Icon name="settings" size={20} />
        </Link>
      </nav>
      {open && (
        <button
          aria-label="Dismiss navigation"
          className="fixed inset-0 z-30 bg-by-surface-scrim min-[1025px]:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        aria-label="Workspace navigation"
        className={`${open ? "fixed inset-y-0 left-16 z-40 flex" : "hidden"} w-[248px] shrink-0 flex-col bg-by-surface-sidebar text-by-text-on-dark min-[1025px]:relative min-[1025px]:left-auto min-[1025px]:flex`}
      >
        <Link to="/app" className="flex h-14 items-center border-b border-by-border-rail px-5">
          <Wordmark />
        </Link>
        <div className="border-b border-by-border-rail px-5 py-5">
          <p className="type-ui-title truncate">{currentOrg?.name || "Your workspace"}</p>
          <Link
            to="/app/integrations"
            className="type-mono-micro mt-2 block text-by-text-on-dark-muted"
          >
            {sourceLabel}
          </Link>
        </div>
        <nav aria-label="Workspace" className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="type-mono-micro px-2 pb-3 pt-2 text-by-text-on-dark-muted">WORKSPACE</p>
          {workspaceNavigation.map((item) => (
            <SidebarItem
              key={item.key}
              to={item.to}
              label={item.label}
              icon={item.icon}
              state={current?.key === item.key ? "active" : "default"}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>
        <div className="space-y-3 border-t border-by-border-rail p-4">
          <SidebarItem
            to="/app/settings"
            label="Settings"
            icon="settings"
            state={path === "/app/settings" ? "active" : "default"}
          />
          <div className="flex items-center gap-3 px-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-by-pill bg-by-avatar-metal text-by-text-primary">
              {(profile?.full_name || user?.email || "B").slice(0, 1).toUpperCase()}
            </span>
            <span className="type-ui-small truncate">{profile?.full_name || "My account"}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="type-ui-small flex w-full items-center gap-2 rounded-by-control px-2 py-2 text-by-text-on-dark-muted hover:bg-by-surface-sidebar-hover disabled:opacity-50"
          >
            <LogOut size={15} />
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-by-border-engraved bg-by-surface-raised px-4 sm:px-6">
          <span className="type-ui-small text-by-text-secondary">Workspace</span>
          <span className="text-by-text-tertiary">/</span>
          <span className="type-ui-title truncate">{current?.label || "Settings & tools"}</span>
          <Link
            to="/app/memory"
            aria-label="Ask Bylda"
            className="type-ui-small ml-auto flex items-center gap-2 rounded-by-control border border-by-border-control px-3 py-2"
          >
            <Icon name="intelligence" />
            <span className="hidden sm:inline">Ask Bylda</span>
          </Link>
          <Link
            to="/app/crm/calls"
            aria-label="Review calls"
            className="type-ui-small flex items-center gap-2 rounded-by-control bg-by-surface-control-dark px-3 py-2 text-by-text-on-control"
          >
            <Icon name="calls" />
            <span className="hidden sm:inline">Review calls</span>
          </Link>
        </header>
        <main id="workspace-content" className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
