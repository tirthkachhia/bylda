// One product, one rail. Launchpad Bylda is a single mission-driven operating
// system with one flat nav (Home, Roadmap, AI Mentors, CRM, Projects,
// Marketing, Automations, Finances, Team, Knowledge, Reports, Settings).
// Exactly one "home" item leads the rail, following the workspace mode:
// Mission Control (create) or Bylda Home (operate). The three operational
// items that need a proven build (Marketing, Automations, Reports) show
// locked until the roadmap says the business is ready — same "unlock"
// language as the rest of the game layer, just inline instead of hidden
// behind a separate command-center sidebar.

import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Settings,
  CreditCard,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpRight,
  Zap,
  Shield,
  Brain,
  Megaphone,
  BarChart3,
  FileText,
  ChevronDown,
  BookOpen,
  ClipboardList,
  MoreHorizontal,
  PlayCircle,
  Search,
  Lock,
  Flame,
  Rocket,
  Home,
  Map,
  Users,
  Building2,
  GraduationCap,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useGuest } from "@/lib/guest";
import { subscriptionQuery } from "@/lib/queries";
import { useIsAdmin } from "@/lib/admin";
import { useBusinessGraph } from "@/hooks/use-business-graph";
import { useFounderProgress } from "@/hooks/use-founder-progress";
import { useFounderStreak } from "@/hooks/use-founder-streak";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { deriveLaunchpadProgress } from "@/lib/ecosystem";

const STORAGE = "bylda-sidebar-collapsed";

/* ─── The unified nav model ──────────────────────────────────
 * A flat list, no product split. `gated` items stay reachable in principle
 * but are visually locked (and non-navigable) until the business has proven
 * itself — deriveLaunchpadProgress().readyForBylda. */
interface NavItem {
  id: string;
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  match: (p: string, search: string) => boolean;
  gated?: boolean;
}

/* Exactly one home per mode: builders live in Mission Control, operators in
 * Bylda Home. The rest of the rail is shared. */
const HOME_CREATE: NavItem = {
  id: "home",
  label: "Mission Control",
  to: "/app/mission-control",
  icon: Home,
  match: (p) => p === "/app/mission-control",
};

const HOME_OPERATE: NavItem = {
  id: "home",
  label: "Bylda Home",
  to: "/app/bylda-home",
  icon: Home,
  match: (p) => p === "/app/bylda-home",
};

const PRIMARY_NAV: NavItem[] = [
  {
    id: "course",
    label: "Course",
    to: "/app/academy",
    icon: GraduationCap,
    match: (p) => p.startsWith("/app/academy"),
  },
  {
    id: "roadmap",
    label: "Roadmap",
    to: "/app/roadmap",
    icon: Map,
    match: (p) => p === "/app/roadmap",
  },
  {
    id: "mentors",
    label: "AI Mentors",
    to: "/app/launchpad/mentors",
    icon: Compass,
    match: (p) => p === "/app/launchpad/mentors",
  },
  {
    id: "crm",
    label: "CRM",
    to: "/app/contacts",
    icon: Users,
    match: (p) => p === "/app/contacts" || p === "/app/leads",
  },
  {
    id: "projects",
    label: "Projects",
    to: "/app/launchpad/missions",
    icon: ClipboardList,
    match: (p) => p === "/app/launchpad/missions",
  },
  {
    id: "marketing",
    label: "Marketing",
    to: "/app/crm/campaigns",
    icon: Megaphone,
    match: (p) => p === "/app/crm/campaigns",
    gated: true,
  },
  {
    id: "automations",
    label: "Automations",
    to: "/app/automations",
    icon: Zap,
    match: (p) => p === "/app/automations" || p === "/app/builder",
    gated: true,
  },
  {
    id: "finances",
    label: "Finances",
    to: "/app/billing",
    icon: CreditCard,
    match: (p) => p === "/app/billing",
  },
  {
    id: "team",
    label: "Team",
    to: "/app/settings",
    search: { tab: "team" },
    icon: Building2,
    match: (p, search) => p === "/app/settings" && search.includes("tab=team"),
  },
  {
    id: "knowledge",
    label: "Knowledge",
    to: "/app/sop-library",
    icon: BookOpen,
    match: (p) => p === "/app/sop-library" || p === "/app/templates",
  },
  {
    id: "reports",
    label: "Reports",
    to: "/app/bylda/reports",
    icon: BarChart3,
    match: (p) => p === "/app/bylda/reports",
    gated: true,
  },
  {
    id: "settings",
    label: "Settings",
    to: "/app/settings",
    icon: Settings,
    match: (p, search) => p === "/app/settings" && !search.includes("tab=team"),
  },
];

/** Deep-cut pages kept reachable without cluttering the primary rail. */
const MORE_NAV: NavItem[] = [
  {
    id: "research",
    label: "Research",
    to: "/app/research",
    icon: Search,
    match: (p) => p === "/app/research",
  },
  {
    id: "assets",
    label: "Assets",
    to: "/app/assets",
    icon: FileText,
    match: (p) => p === "/app/assets",
  },
  {
    id: "memory",
    label: "Memory",
    to: "/app/memory",
    icon: Brain,
    match: (p) => p.startsWith("/app/memory"),
  },
];

export function AppSidebar({ onOpenRail: _onOpenRail }: { onOpenRail?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const graph = useBusinessGraph();
  const progress = deriveLaunchpadProgress(graph);
  const unlocked = progress.readyForBylda;
  const { isOperate } = useWorkspaceMode();
  const nav = [isOperate ? HOME_OPERATE : HOME_CREATE, ...PRIMARY_NAV];

  return (
    <SidebarChrome brand="Bylda" tagline="Your business operating system" brandIcon={Rocket}>
      {({ collapsed }) => (
        <>
          <div className={cn("px-2 space-y-px", collapsed && "px-1.5")}>
            {nav.map((item) => (
              <NavRow
                key={item.id}
                to={item.to}
                search={item.search}
                label={item.label}
                icon={item.icon}
                active={item.match(path, search)}
                collapsed={collapsed}
                locked={item.gated && !unlocked}
                lockHint="Unlocks once your build is proven — see your Roadmap"
              />
            ))}
          </div>

          <SupportGroup
            label="More"
            items={MORE_NAV}
            path={path}
            search={search}
            collapsed={collapsed}
            storageKey="lp-more-open"
          />
        </>
      )}
    </SidebarChrome>
  );
}

/* ─── Shared pieces ────────────────────────────────────────── */

function NavRow({
  to,
  search,
  label,
  icon: Icon,
  active,
  collapsed,
  locked,
  lockHint,
}: {
  to: string;
  search?: Record<string, string>;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  locked?: boolean;
  lockHint?: string;
}) {
  if (locked) {
    return (
      <div
        title={collapsed ? `${label} · ${lockHint ?? "Locked"}` : lockHint}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-[8px] opacity-45",
          collapsed && "justify-center px-0 w-8 mx-auto",
        )}
        style={{ color: "var(--muted-foreground)" }}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-[13px]">{label}</span>
            <Lock className="h-3 w-3 shrink-0" />
          </>
        )}
      </div>
    );
  }

  return (
    <Link
      to={to}
      search={search as never}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-[8px] transition-all duration-100",
        collapsed && "justify-center px-0 w-8 mx-auto",
        active ? "font-semibold" : "hover:bg-surface-2",
      )}
      style={
        active
          ? { background: "var(--primary-soft)", color: "var(--primary)" }
          : { color: "var(--muted-foreground)" }
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1 text-[13px]">{label}</span>}
    </Link>
  );
}

/** Collapsible support area — progressive disclosure, closed by default,
 *  auto-opens when the active route lives inside it. */
function SupportGroup({
  label,
  items,
  path,
  search,
  collapsed,
  storageKey,
}: {
  label: string;
  items: NavItem[];
  path: string;
  search: string;
  collapsed: boolean;
  storageKey: string;
}) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const hasActive = items.some((i) => i.match(path, search));
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* */
      }
      return next;
    });
  };

  return (
    <div>
      <div className="px-2 pt-4">
        <button
          onClick={toggle}
          title={collapsed ? label : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left transition-colors hover:bg-surface-2",
            collapsed && "justify-center px-0",
          )}
          style={{ color: "var(--muted-foreground)" }}
        >
          {!collapsed ? (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-widest opacity-55">
                {label}
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 opacity-40 transition-transform duration-150",
                  open && "rotate-180",
                )}
              />
            </>
          ) : (
            <MoreHorizontal className="h-3.5 w-3.5 opacity-50" />
          )}
        </button>
      </div>
      {(open || collapsed) && (
        <div className={cn("px-2 space-y-px pt-0.5", collapsed && "px-1.5")}>
          {items.map((item) => (
            <NavRow
              key={item.id}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={item.match(path, search)}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Shared chrome: header, footer, collapse. */
function SidebarChrome({
  brand,
  tagline,
  brandIcon: BrandIcon,
  children,
}: {
  brand: string;
  tagline: string;
  brandIcon: LucideIcon;
  children: (ctx: { collapsed: boolean }) => React.ReactNode;
}) {
  const { currentOrg, currentOrgId, profile, user } = useAuth();
  const { isGuest, disable } = useGuest();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const founder = useFounderProgress();
  const streak = useFounderStreak();
  const levelColor = `var(--level-${founder.level}-color)`;

  const subQ = useQuery({ ...subscriptionQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const plan = subQ.data?.plan ?? "starter";

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE) === "1") setCollapsed(true);
    } catch {
      /* */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const n = !c;
      try {
        localStorage.setItem(STORAGE, n ? "1" : "0");
      } catch {
        /* */
      }
      return n;
    });
  };

  const exitDemo = () => {
    disable();
    navigate({ to: "/signup", search: { plan: undefined } });
  };

  const initials = (profile?.full_name || user?.email || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const footerItems = [
    ...(isAdmin ? [{ to: "/app/admin", label: "Admin", icon: Shield }] : []),
    { to: "/app/tutorials", label: "Help & Tutorials", icon: PlayCircle },
  ];

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const orgName = currentOrg?.name ?? `${planLabel} plan`;
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Account";

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 flex-col relative select-none",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-[56px]" : "w-[240px]",
      )}
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* ── Brand header ── */}
      <div
        className={cn(
          "flex h-[52px] shrink-0 items-center gap-2.5 px-3",
          collapsed && "justify-center px-0",
        )}
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: "linear-gradient(140deg, var(--primary), var(--orbit-accent))",
            color: "#fff",
            boxShadow: "0 4px 16px color-mix(in oklab, var(--primary) 45%, transparent)",
          }}
        >
          <BrandIcon className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div
              className="font-display text-[13px] font-bold leading-tight truncate"
              style={{ color: "var(--foreground)" }}
            >
              {brand}
            </div>
            <div
              className="text-[11px] leading-tight truncate mt-px"
              style={{ color: "var(--muted-foreground)" }}
            >
              {tagline} · {orgName}
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex flex-1 flex-col overflow-y-auto py-2">{children({ collapsed })}</nav>

      {/* ── Footer ── */}
      <div className="shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className={cn("p-2 space-y-px", collapsed && "px-1.5")}>
          {isGuest && (
            <button
              onClick={exitDemo}
              title={collapsed ? "Exit demo" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[12.5px] font-medium transition-colors",
                collapsed && "justify-center px-0 w-8 mx-auto",
              )}
              style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
            >
              <ArrowUpRight className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Exit demo</span>}
            </button>
          )}

          {footerItems.map((item) => (
            <NavRow
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={path === item.to || path.startsWith(item.to + "/")}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Progression — the game layer, always in view */}
        <div className={cn("px-2 pb-1.5", collapsed && "px-1.5")}>
          <Link
            to="/app/roadmap"
            title={
              collapsed
                ? `Level ${founder.level} · ${founder.levelLabel} · ${streak.currentStreak}-day streak`
                : undefined
            }
            className={cn(
              "block rounded-xl border transition-colors hover:bg-surface-2",
              collapsed ? "flex justify-center p-1.5" : "p-2.5",
            )}
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            {collapsed ? (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-black text-white"
                style={{
                  background: `linear-gradient(150deg, color-mix(in oklab, ${levelColor} 82%, black), ${levelColor})`,
                }}
              >
                {founder.level}
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10.5px] font-black text-white"
                    style={{
                      background: `linear-gradient(150deg, color-mix(in oklab, ${levelColor} 82%, black), ${levelColor})`,
                    }}
                  >
                    {founder.level}
                  </span>
                  <div
                    className="min-w-0 flex-1 truncate text-[11.5px] font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Level {founder.level} · {founder.levelLabel}
                  </div>
                  <span
                    className="shrink-0 font-mono text-[10px]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {founder.xpProgressInLevel}%
                  </span>
                </div>
                <div className="context-xp-bar mt-2">
                  <div className="fill" style={{ width: `${founder.xpProgressInLevel}%` }} />
                </div>
                {streak.currentStreak > 0 && (
                  <div
                    className="mt-1.5 flex items-center gap-1 text-[10.5px] font-bold"
                    style={{ color: "var(--warning)" }}
                  >
                    <Flame className="h-3 w-3" />
                    {streak.currentStreak}-day streak
                  </div>
                )}
              </>
            )}
          </Link>
        </div>

        {/* User card */}
        <div className={cn("px-2 pb-2", collapsed && "px-1.5")}>
          <button
            onClick={() => navigate({ to: "/app/settings" })}
            title={collapsed ? displayName : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg p-2 transition-colors duration-150",
              collapsed && "justify-center p-1.5",
              "hover:bg-surface-2",
            )}
            style={{ border: "1px solid var(--border)" }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: "var(--primary)" }}
            >
              {initials}
            </span>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <div
                    className="truncate text-[12px] font-semibold leading-tight"
                    style={{ color: "var(--foreground)" }}
                  >
                    {displayName}
                  </div>
                  <div
                    className="truncate text-[10.5px] leading-tight mt-px"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {planLabel} plan
                  </div>
                </div>
                <MoreHorizontal
                  className="h-3.5 w-3.5 shrink-0 opacity-40"
                  style={{ color: "var(--foreground)" }}
                />
              </>
            )}
          </button>

          <button
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-[11px] transition-colors hover:bg-surface-2",
              collapsed && "justify-center",
            )}
            style={{ color: "var(--muted-foreground)" }}
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <>
                <ChevronsLeft className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
