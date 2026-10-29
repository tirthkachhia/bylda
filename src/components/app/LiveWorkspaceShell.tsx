import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Inactive } from "@/components/app/FigmaPrimitives";
import { guestStore } from "@/lib/guest";
import { supabase } from "@/integrations/supabase/client";
import { integrationsQuery } from "@/lib/queries";
import { clearLastAppPath } from "@/lib/session-restore";
import { initials } from "@/lib/coaching/calls";
import { behavioralNavigation, workspaceNavigation } from "@/lib/workspace-navigation";

export function LiveWorkspaceShell({ children }: { children: ReactNode }) {
  const { user, profile, currentOrg, signOut } = useAuth(),
    queryClient = useQueryClient(),
    navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const path = location.pathname,
    view = (location.search as Record<string, unknown>).view;
  const [open, setOpen] = useState(false),
    [leaving, setLeaving] = useState(false),
    [query, setQuery] = useState("");
  const sidebar = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  const connections = useQuery({ ...integrationsQuery(user?.id ?? ""), enabled: !!user });
  const unread = useQuery({
    queryKey: ["figma-notifications", user?.id, "unread-count"],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const active =
    path.replace(/\/$/, "") === "/app"
      ? "home"
      : path === "/app/crm/calls"
        ? typeof view === "string"
          ? view
          : "calls"
        : (workspaceNavigation.find((item) => item.to === path)?.key ?? null);
  const current =
    path === "/app/crm/calls" && view === "report"
      ? "Reports"
      : path === "/app/crm/calls" && view === "playbooks"
        ? "Methodology"
        : (behavioralNavigation.find((item) => item.key === active)?.label ??
          workspaceNavigation.find((item) => item.to === path)?.label ??
          "Workspace");
  useEffect(() => setOpen(false), [path, view]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const items = [
          ...(sidebar.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled]),summary",
          ) ?? []),
        ];
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    sidebar.current?.querySelector<HTMLElement>("a,button")?.focus();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  async function logout() {
    setLeaving(true);
    try {
      await signOut();
      guestStore.disable();
      clearLastAppPath();
      queryClient.clear();
      await navigate({ to: "/auth/sign-in", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    } finally {
      setLeaving(false);
    }
  }
  const sourceLabel = connections.isError
    ? "Connection check failed"
    : connections.isPending
      ? "Checking sources…"
      : `${connections.data?.filter((i) => i.is_connected).length ?? 0} sources connected`;
  return (
    <div className="bylda light revenue-workspace v1-workspace figma-surface flex h-dvh overflow-hidden bg-by-surface-canvas text-by-text-primary">
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4"
      >
        Skip to content
      </a>
      <nav
        aria-label="Workspace rail"
        className="workspace-rail flex w-16 shrink-0 flex-col items-center gap-3 bg-by-surface-rail py-4"
      >
        <Link
          to="/app"
          aria-label="Bylda home"
          className="mb-3 flex size-10 items-center justify-center"
        >
          <img
            src="/figma/workspace.png"
            alt=""
            width="38"
            height="38"
            className="rounded-[10px] object-contain"
          />
        </Link>
        <button
          ref={menuButton}
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="workspace-navigation"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 min-[1025px]:hidden"
        >
          <Menu size={19} />
        </button>
        <Link
          to="/app"
          aria-label="Home"
          className={`flex size-[38px] items-center justify-center rounded-[10px] ${active === "home" ? "bg-by-surface-sidebar-active" : ""}`}
        >
          <img src="/figma/rail-home.svg" alt="" />
        </Link>
        <button
          type="button"
          aria-label="Search calls"
          onClick={() => document.getElementById("workspace-search")?.focus()}
          className="flex size-[38px] items-center justify-center rounded-[10px]"
        >
          <img src="/figma/rail-search.svg" alt="" />
        </button>
        <Link
          to="/app/notifications"
          aria-label="Open notifications"
          className="flex size-[38px] items-center justify-center rounded-[10px]"
        >
          <img src={unread.data ? "/figma/notifications.svg" : "/figma/bell.svg"} alt="" />
        </Link>
        <button
          type="button"
          disabled
          aria-label="Ask Bylda (not available yet)"
          title="Not available yet"
          className="flex size-[38px] items-center justify-center rounded-[10px] opacity-40"
        >
          <img src="/figma/rail-insights.svg" alt="" />
        </button>
        <Link
          to="/app/settings"
          aria-label="Settings"
          className="mt-auto flex size-[38px] items-center justify-center rounded-[10px]"
        >
          <img src="/figma/rail-settings.svg" alt="" />
        </Link>
        <span
          title={profile?.full_name ?? user?.email ?? "My account"}
          className="flex size-[34px] items-center justify-center rounded-full border border-by-text-primary bg-by-avatar-metal text-[11px]"
        >
          {initials(profile?.full_name ?? user?.email ?? "B")}
        </span>
      </nav>
      {open && (
        <button
          type="button"
          aria-label="Dismiss navigation"
          className="fixed inset-0 z-30 bg-by-surface-scrim min-[1025px]:hidden"
          onClick={() => {
            setOpen(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        aria-label="Workspace navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        className={`${open ? "fixed inset-y-0 left-16 z-40 flex" : "hidden"} w-[248px] shrink-0 flex-col bg-by-surface-sidebar px-3 py-4 min-[1025px]:relative min-[1025px]:left-auto min-[1025px]:flex`}
      >
        <div className="mb-3 flex items-center justify-between px-2">
          <Link to="/app" className="text-[15px] tracking-[-.15px]">
            BYLDA
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => {
              setOpen(false);
              menuButton.current?.focus();
            }}
            className="p-1 min-[1025px]:hidden"
          >
            <X size={17} />
          </button>
        </div>
        <button
          type="button"
          disabled
          title="Workspace switching is not available yet"
          className="mb-5 flex w-full text-left items-center gap-2 rounded-lg bg-by-surface-sidebar-active/40 px-3 py-2"
        >
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-medium">
              {currentOrg?.name || "Your workspace"}
            </strong>
            <span className="mt-0.5 block text-[12px] text-by-text-secondary">{sourceLabel}</span>
          </span>
          <img src="/figma/chevron.svg" alt="" />
        </button>
        <nav aria-label="Workspace" className="space-y-1">
          {behavioralNavigation.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={"view" in item ? ({ view: item.view } as never) : undefined}
              aria-current={active === item.key ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${active === item.key ? "bg-by-surface-sidebar-active font-medium" : "hover:bg-by-surface-sidebar-hover"}`}
            >
              <img src={`/figma/${item.asset}.svg`} alt="" />
              {item.label}
            </Link>
          ))}
        </nav>
        <section className="mt-6 space-y-1 text-xs" aria-label="Pinned views">
          <h2 className="px-3 py-2 text-[11px] uppercase text-by-text-secondary">Pinned views</h2>
          {["Needs review", "High coaching value", "Price objections"].map((label) => (
            <Inactive
              key={label}
              className="!w-full !justify-between !border-0 !bg-transparent !px-3"
            >
              {label}
              <span>—</span>
            </Inactive>
          ))}
        </section>
        <section className="mt-5 text-xs" aria-label="Conversations">
          <h2 className="px-3 py-2 text-[11px] uppercase text-by-text-secondary">Conversations</h2>
          <Inactive className="!w-full !justify-start !border-0 !bg-transparent !px-3">
            Rooms and messages
          </Inactive>
        </section>
        <nav aria-label="Workspace configuration" className="mt-auto space-y-1 pt-8">
          <Link
            to="/app/crm/calls"
            search={{ view: "playbooks" }}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${view === "playbooks" && path === "/app/crm/calls" ? "bg-by-surface-sidebar-active" : ""}`}
          >
            <img src="/figma/nav-insights.svg" alt="" />
            Methodology
          </Link>
          <Link
            to="/app/integrations"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px]"
          >
            <img src="/figma/nav-integrations.svg" alt="" />
            Integrations
          </Link>
          <Link
            to="/app/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px]"
          >
            <img src="/figma/nav-settings.svg" alt="" />
            Settings
          </Link>
          <button
            type="button"
            disabled={leaving}
            onClick={() => void logout()}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-by-text-secondary disabled:opacity-40"
          >
            <LogOut size={14} />
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 text-xs sm:px-6">
          <span className="hidden truncate text-by-text-secondary sm:block">
            {current}
            {path === "/app/crm/calls" && (location.search as Record<string, unknown>).callId
              ? " / Call review"
              : ""}
          </span>
          <form
            className="ml-auto flex min-w-0 items-center gap-2 rounded-md border border-by-border-engraved bg-white/70 px-2.5 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({ to: "/app/crm/calls", search: { view: "calls", q: query } as never });
            }}
          >
            <img src="/figma/search.svg" alt="" />
            <input
              id="workspace-search"
              aria-label="Search workspace calls"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search calls, accounts…"
              className="w-32 bg-transparent text-xs outline-none lg:w-52"
            />
            <kbd className="hidden text-[10px] text-by-text-tertiary lg:block">↵</kbd>
          </form>
          <Link
            to="/app/crm/calls"
            search={{ view: "calls", upload: true } as never}
            className="shrink-0 rounded-md bg-by-surface-control-dark px-3 py-2 text-xs text-white"
          >
            + Upload
          </Link>
          <Link to="/app/notifications" className="figma-button !p-2" aria-label="Notifications">
            <img src="/figma/bell.svg" alt="" />
          </Link>
        </header>
        <main id="workspace-content" className="min-h-0 flex-1 overflow-y-auto p-2 pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
