import { Link, useMatches, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { mocksForced, useHasUnread, useSidebar, useTeams, useViewer } from "@/lib/data";
import { Avatar } from "../kit/Avatar";
import { Wordmark } from "../kit/ByldaGlyph";
import { cn } from "../kit/cn";
import { Icon, type IconName } from "../kit/Icon";
import { SidebarItem } from "../kit/SidebarItem";
import { StateLoading } from "../states/SystemState";
import { NewMenu, ProfileMenu, WorkspaceSwitcher } from "../menus/ShellMenus";
import { ContextPanelProvider } from "./ContextPanel";
import { activeKey, navFor } from "./nav";
import { crumbFor } from "./crumb";
import { screenForRoute } from "./screens";

/*
 * App Shell / Navigation v2 (37:51) + Workspace Top Bar (36:52).
 *   rail 64 | sidebar 248 | top bar 56 + main | context 344
 *   ≤1280: context panel → overlay drawer · ≤1024: icon rail only (sidebar → drawer)
 * Overlays owned by lanes, mounted here: S1 ⌘K palette + S3 Ask Bylda (Lane 2),
 * N1 notifications drawer (Lane 1). The shell owns their geometry; lanes own content.
 */
const S1CommandPalette = lazy(() =>
  import("@/components/lanes/lane-2/search/S1CommandPalette").then((m) => ({
    default: m.S1CommandPalette,
  })),
);
const S3AskByldaPanel = lazy(() =>
  import("@/components/lanes/lane-2/search/S3AskByldaPanel").then((m) => ({
    default: m.S3AskByldaPanel,
  })),
);
const N1NotificationsDrawer = lazy(() =>
  import("@/components/lanes/lane-1/notifications/N1NotificationsDrawer").then((m) => ({
    default: m.N1NotificationsDrawer,
  })),
);

type Overlay = "palette" | "ask" | "notifications" | null;

export function AppShell({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [panelNode, setPanelNode] = useState<HTMLElement | null>(null);
  const [panelCount, setPanelCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [navDrawer, setNavDrawer] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setNavDrawer(false), [pathname]);

  const toggle = useCallback(
    (o: Exclude<Overlay, null>) => setOverlay((cur) => (cur === o ? null : o)),
    [],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle("palette");
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        toggle("ask");
      } else if (e.key === "Escape") setOverlay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const hasPanel = panelCount > 0;
  const close = () => setOverlay(null);

  return (
    <div className="bylda flex h-screen overflow-hidden">
      {mocksForced() ? (
        <div
          role="status"
          className="fixed bottom-3 right-3 z-50 rounded-by-control bg-by-surface-control-dark px-4 py-2 text-by-text-on-control type-ui-small"
        >
          Demo mode · sample data
        </div>
      ) : null}
      <Rail onOverlay={toggle} overlay={overlay} onToggleNav={() => setNavDrawer((v) => !v)} />

      {/* Sidebar: inline >1024, drawer ≤1024 */}
      <div className="hidden min-[1025px]:flex">
        <Sidebar pathname={pathname} />
      </div>
      {navDrawer ? (
        <div
          className="fixed inset-0 z-40 flex min-[1025px]:hidden"
          onClick={() => setNavDrawer(false)}
        >
          <div
            className="ml-by-rail h-full shadow-by-float animate-by-slide-right"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar pathname={pathname} />
          </div>
          <div className="flex-1 bg-by-surface-scrim" />
        </div>
      ) : null}

      <ContextPanelProvider node={panelNode} onCountChange={setPanelCount}>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onSearch={() => toggle("palette")}
            onBell={() => toggle("notifications")}
            onAsk={() => toggle("ask")}
            hasPanel={hasPanel}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
          />
          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto bg-by-surface-canvas">{children}</main>

            {/* S3 Ask Bylda — 440, main shrinks */}
            {overlay === "ask" ? (
              <aside
                className="w-by-ask shrink-0 overflow-y-auto border-l border-by-border-engraved bg-by-surface-raised animate-by-slide-right"
                aria-label="Ask Bylda"
              >
                <Suspense fallback={<StateLoading />}>
                  <S3AskByldaPanel onClose={close} />
                </Suspense>
              </aside>
            ) : null}

            {/* Context panel — inline >1280, drawer ≤1280. Always mounted so screens can portal into it. */}
            <aside
              ref={setPanelNode}
              aria-label="Context"
              className={cn(
                "w-by-context shrink-0 overflow-y-auto border-l border-by-border-engraved bg-by-surface-raised",
                !hasPanel || !panelOpen || overlay === "ask"
                  ? "hidden"
                  : "hidden min-[1281px]:block",
                hasPanel &&
                  panelOpen &&
                  overlay !== "ask" &&
                  "max-[1280px]:fixed max-[1280px]:inset-y-0 max-[1280px]:right-0 max-[1280px]:z-30 max-[1280px]:block max-[1280px]:shadow-by-float",
              )}
            />
          </div>
        </div>
      </ContextPanelProvider>

      {/* N1 notifications drawer — 400 */}
      {overlay === "notifications" ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-by-surface-scrim" onClick={close}>
          <aside
            className="h-full w-by-drawer overflow-y-auto bg-by-surface-raised shadow-by-float animate-by-slide-right"
            onClick={(e) => e.stopPropagation()}
            aria-label="Notifications"
          >
            <Suspense fallback={<StateLoading />}>
              <N1NotificationsDrawer onClose={close} />
            </Suspense>
          </aside>
        </div>
      ) : null}

      {/* S1 ⌘K palette */}
      {overlay === "palette" ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-by-surface-scrim pt-[12vh]"
          onClick={close}
        >
          <div
            className="w-[640px] max-w-[calc(100vw-32px)] overflow-hidden rounded-by-menu border border-by-border-engraved bg-by-surface-raised shadow-by-float"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Search"
          >
            <Suspense fallback={<StateLoading />}>
              <S1CommandPalette onClose={close} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Rail (64) ─────────────────────────────────────────────────────────────── */
function RailButton({
  icon,
  label,
  active,
  onClick,
  to,
  dot,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
  dot?: boolean;
}) {
  const cls = cn(
    "relative flex size-[38px] items-center justify-center rounded-by-card text-by-text-on-dark-muted transition-colors hover:text-by-text-on-dark",
    active && "bg-by-surface-rail-active text-by-text-on-dark",
  );
  const inner = (
    <>
      <Icon name={icon} size={18} />
      {dot ? (
        <span
          className="absolute right-[9px] top-[9px] size-1.5 rounded-by-pill bg-by-signal-regress"
          aria-label="unread"
        />
      ) : null}
    </>
  );
  return to ? (
    <Link to={to as never} className={cls} aria-label={label} title={label}>
      {inner}
    </Link>
  ) : (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      {inner}
    </button>
  );
}

function Rail({
  onOverlay,
  overlay,
  onToggleNav,
}: {
  onOverlay: (o: "palette" | "ask" | "notifications") => void;
  overlay: Overlay;
  onToggleNav: () => void;
}) {
  const viewer = useViewer();
  const teams = useTeams();
  const unread = useHasUnread();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const v = viewer.data;
  const nav = v ? navFor(v.role, v.id) : null;
  const home = nav?.primary.find((i) => i.key === "home");
  const settings = nav?.bottom.find((i) => i.key === "settings");
  const canManageTeams = v && (v.role === "owner" || v.role === "admin");
  return (
    <nav
      className="flex w-by-rail shrink-0 flex-col items-center gap-2.5 bg-by-surface-rail py-3.5"
      aria-label="Workspace rail"
    >
      <button
        type="button"
        onClick={onToggleNav}
        className="flex size-[38px] items-center justify-center rounded-by-card bg-by-surface-raised text-by-text-primary"
        aria-label="Workspace and navigation"
      >
        <span className="type-brand-logo">B</span>
      </button>
      <span className="h-px w-[22px] bg-by-border-rail" />
      {home ? (
        <RailButton
          icon="home"
          label="Home"
          to={home.to}
          active={activeKey(nav!.primary, pathname) === "home" && overlay === null}
        />
      ) : null}
      <RailButton
        icon="search"
        label="Search (⌘K)"
        onClick={() => onOverlay("palette")}
        active={overlay === "palette"}
      />
      <RailButton
        icon="bell"
        label="Notifications"
        onClick={() => onOverlay("notifications")}
        active={overlay === "notifications"}
        dot={unread.data === true}
      />
      <RailButton
        icon="intelligence"
        label="Ask Bylda (/)"
        onClick={() => onOverlay("ask")}
        active={overlay === "ask"}
      />
      {v && v.role !== "rep" ? (
        <>
          <span className="h-px w-[22px] bg-by-border-rail" />
          {(teams.data ?? [])
            .filter((t) => t.status === "active")
            .map((t) => (
              <Link
                key={t.id}
                to={`/app/team/${t.id}` as never}
                title={t.name}
                className={cn(
                  "type-mono-micro flex size-[38px] items-center justify-center rounded-by-pill border border-by-border-rail bg-by-surface-rail-chip text-by-text-sidebar hover:text-by-text-on-dark",
                  pathname.startsWith(`/app/team/${t.id}`) && "text-by-text-on-dark",
                )}
              >
                {t.short}
              </Link>
            ))}
          {canManageTeams ? (
            <Link
              to={"/app/workspace/teams" as never}
              title="Add team"
              className="flex size-[38px] items-center justify-center rounded-by-pill border border-by-border-rail text-by-text-on-dark-muted hover:text-by-text-on-dark"
            >
              <Icon name="plus" size={16} />
            </Link>
          ) : null}
        </>
      ) : null}
      <span className="flex-1" />
      {settings ? <RailButton icon="settings" label="Settings" to={settings.to} /> : null}
      <ProfileMenu>
        <button type="button" aria-label="Profile menu" className="rounded-by-pill">
          <Avatar name={v?.name ?? "…"} src={v?.avatarUrl} size={34} />
        </button>
      </ProfileMenu>
    </nav>
  );
}

/* ── Sidebar (248) ─────────────────────────────────────────────────────────── */
function Section({ label, addTo }: { label: string; addTo?: string }) {
  return (
    <div className="flex items-center pb-1.5 pl-2.5 pr-2 pt-3.5">
      <span className="type-ui-label flex-1 text-by-text-on-dark-muted">{label}</span>
      {addTo ? (
        <Link
          to={addTo as never}
          aria-label={`Add to ${label.toLowerCase()}`}
          className="text-by-text-on-dark-muted hover:text-by-text-on-dark"
        >
          <Icon name="plus" size={13} />
        </Link>
      ) : null}
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const viewer = useViewer();
  const sidebar = useSidebar();
  const v = viewer.data;
  const nav = v ? navFor(v.role, v.id) : null;
  const active = nav ? activeKey([...nav.primary, ...nav.bottom], pathname) : null;
  const lists = sidebar.data;
  return (
    <nav
      className="flex h-full w-by-sidebar shrink-0 flex-col gap-px overflow-y-auto bg-by-surface-sidebar px-3 pb-3.5 pt-4"
      aria-label="Main"
    >
      <div className="pb-2.5 pl-2.5 text-by-text-on-control">
        <Wordmark />
      </div>
      <WorkspaceSwitcher>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-by-tile bg-by-surface-sidebar-hover py-2 pl-2.5 pr-2 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="type-ui-body-strong truncate text-by-text-on-control">
              {v?.workspace?.name ?? "Workspace"}
            </span>
            <span className="type-ui-small truncate text-by-text-on-dark-muted">
              {v?.team ? `${v.team.name} · ${v.team.repCount} reps` : (v?.subtitle ?? "")}
            </span>
          </span>
          <Icon name="chevron" size={14} className="text-by-text-on-dark-muted" />
        </button>
      </WorkspaceSwitcher>
      <span className="h-2" />
      {nav?.primary.map((i) => (
        <SidebarItem
          key={i.key}
          to={i.to}
          icon={i.icon}
          label={i.label}
          state={active === i.key ? "active" : "default"}
        />
      ))}

      {lists && lists.rooms.length > 0 ? (
        <>
          <Section label="My rooms" addTo="/app/rooms/new" />
          {lists.rooms.map((r) => (
            <SidebarItem
              key={r.id}
              to={`/app/rooms/${r.id}`}
              icon="hash"
              label={r.name}
              state={
                pathname.startsWith(`/app/rooms/${r.id}`)
                  ? "active"
                  : r.hasMention
                    ? "default"
                    : r.unread > 0
                      ? "unread"
                      : "default"
              }
              meta={r.hasMention && r.unread > 0 ? r.unread : undefined}
            />
          ))}
        </>
      ) : null}

      {lists && lists.people.length > 0 ? (
        <>
          <Section label="People" addTo="/app/workspace/users" />
          {lists.people.map((p) => (
            <SidebarItem
              key={p.id}
              to={`/app/team/reps/${p.id}`}
              leading={<Avatar name={p.name} size={16} />}
              label={p.name}
              meta={
                p.presence === "on_call" ? "on a call" : p.presence === "away" ? "away" : undefined
              }
              state={pathname.startsWith(`/app/team/reps/${p.id}`) ? "active" : "default"}
            />
          ))}
        </>
      ) : null}

      {lists && lists.dms.length > 0 ? (
        <>
          <Section label="Direct messages" addTo="/app/dm/new" />
          {lists.dms.map((d) => (
            <SidebarItem
              key={d.id}
              to={d.isCoach ? "/app/dm/coach" : `/app/dm/${d.id}`}
              leading={
                d.isCoach ? (
                  <Icon name="intelligence" size={16} />
                ) : (
                  <Avatar name={d.title} size={16} />
                )
              }
              label={d.title}
              meta={d.unread > 0 ? d.unread : undefined}
              state={
                pathname === (d.isCoach ? "/app/dm/coach" : `/app/dm/${d.id}`)
                  ? "active"
                  : "default"
              }
            />
          ))}
          <SidebarItem
            to="/app/search"
            icon="bookmark"
            label="Saved"
            meta={lists.savedCount || undefined}
          />
        </>
      ) : null}

      <Section label="Revenue workspace" />
      {[
        ["Today", "/app", "home"],
        ["Call actions & CRM write-back", "/app/crm/calls", "calls"],
        ["Deal memory", "/app/memory", "file"],
        ["Context memory", "/app/context-memory", "intelligence"],
        ["CRM records", "/app/contacts", "user"],
        ["Forecast", "/app/bylda/reports", "reports"],
        ["CRM intelligence", "/app/crm/setup", "plug"],
        ["Automations", "/app/automations", "settings"],
        ["Integrations & write-back", "/app/integrations", "plug"],
        ["Account settings", "/app/settings", "settings"],
      ].map(([label, to, icon]) => (
        <SidebarItem
          key={to}
          label={label}
          to={to}
          icon={icon as IconName}
          state={pathname === to ? "active" : "default"}
        />
      ))}
      <span className="min-h-4 flex-1" />
      {nav?.bottom.map((i) => (
        <SidebarItem
          key={i.key}
          to={i.to}
          icon={i.icon}
          label={i.label}
          state={active === i.key ? "active" : "default"}
        />
      ))}
    </nav>
  );
}

/* ── Top bar (56) ──────────────────────────────────────────────────────────── */
function useCrumb(): string {
  const matches = useMatches();
  const last = matches[matches.length - 1];
  const entry = last ? screenForRoute(last.fullPath) : undefined;
  if (entry) return crumbFor(entry);
  return last?.pathname ?? "";
}

function TopBar({
  onSearch,
  onBell,
  onAsk,
  hasPanel,
  panelOpen,
  onTogglePanel,
}: {
  onSearch: () => void;
  onBell: () => void;
  onAsk: () => void;
  hasPanel: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const crumb = useCrumb();
  return (
    <header className="flex h-by-topbar shrink-0 items-center gap-2.5 border-b border-by-border-engraved bg-by-surface-raised pl-7 pr-5">
      <p className="type-ui-small min-w-0 flex-1 truncate text-by-text-secondary">{crumb}</p>
      <button
        type="button"
        onClick={onSearch}
        className="flex h-[34px] w-by-search items-center gap-2 overflow-hidden rounded-by-tile border border-by-border-engraved bg-by-surface-inset py-[7px] pl-3 pr-2 text-left max-[1100px]:w-[200px]"
      >
        <Icon name="search" size={15} className="text-by-text-tertiary" />
        <span className="type-ui-small flex-1 truncate text-by-text-tertiary">
          Search calls, people, insights…
        </span>
        <kbd className="type-mono-micro rounded-by-badge border border-by-border-engraved bg-by-surface-raised px-[5px] py-0.5 text-by-text-secondary">
          ⌘ K
        </kbd>
      </button>
      <NewMenu onAsk={onAsk}>
        <button
          type="button"
          className="type-ui-body-strong flex items-center gap-1.5 rounded-by-control bg-by-surface-control-dark py-2 pl-3 pr-3.5 text-by-text-on-control"
        >
          <Icon name="plus" size={14} />
          New
        </button>
      </NewMenu>
      <button
        type="button"
        onClick={onBell}
        className="flex size-[34px] items-center justify-center rounded-by-tile border border-by-border-engraved text-by-text-primary"
        aria-label="Notifications"
      >
        <Icon name="bell" size={17} />
      </button>
      {hasPanel ? (
        <button
          type="button"
          onClick={onTogglePanel}
          className="flex size-[34px] items-center justify-center rounded-by-tile border border-by-border-engraved text-by-text-secondary"
          aria-label={panelOpen ? "Close context panel" : "Open context panel"}
          aria-pressed={panelOpen}
        >
          <Icon name={panelOpen ? "x" : "more"} size={16} />
        </button>
      ) : null}
    </header>
  );
}
