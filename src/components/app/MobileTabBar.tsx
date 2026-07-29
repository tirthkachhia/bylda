// Mobile nav — one bar per product, mirroring each product's sidebar.
//   Launchpad: Home · Missions · Research · Memory · Ask
//   Bylda:      Home · CRM · Pipeline · Tasks · Ask
// Same rule as desktop: the two products never share navigation.

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Crosshair,
  Search,
  Brain,
  Sparkles,
  Users,
  Workflow,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}

const LAUNCHPAD_TABS: Tab[] = [
  {
    to: "/app/mission-control",
    label: "Home",
    icon: Home,
    match: (p) => p === "/app/mission-control" || p === "/app/",
  },
  {
    to: "/app/launchpad/missions",
    label: "Missions",
    icon: Crosshair,
    match: (p) => p === "/app/launchpad/missions" || p.startsWith("/app/outcomes"),
  },
  {
    to: "/app/research",
    label: "Research",
    icon: Search,
    match: (p) => p === "/app/research" || p.startsWith("/app/launchpad"),
  },
  {
    to: "/app/memory",
    label: "Memory",
    icon: Brain,
    match: (p) => p.startsWith("/app/memory") || p === "/app/assets",
  },
  {
    to: "/app/mentor",
    label: "Ask",
    icon: Sparkles,
    match: (p) => p === "/app/mentor",
  },
];

const BYLDA_TABS: Tab[] = [
  {
    to: "/app/bylda-home",
    label: "Home",
    icon: Home,
    match: (p) => p === "/app/bylda-home" || p === "/app/",
  },
  {
    to: "/app/contacts",
    label: "CRM",
    icon: Users,
    match: (p) => p === "/app/contacts" || p === "/app/leads" || p === "/app/crm/companies",
  },
  {
    to: "/app/bylda/crm",
    label: "Pipeline",
    icon: Workflow,
    match: (p) => p === "/app/bylda/crm" || p === "/app/bylda",
  },
  {
    to: "/app/crm/tasks",
    label: "Tasks",
    icon: ClipboardList,
    match: (p) => p === "/app/crm/tasks",
  },
  {
    to: "/app/mentor",
    label: "Ask",
    icon: Sparkles,
    match: (p) => p === "/app/mentor",
  },
];

export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isOperate } = useWorkspaceMode();
  const tabs = isOperate ? BYLDA_TABS : LAUNCHPAD_TABS;

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = t.match(path);
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
                style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
