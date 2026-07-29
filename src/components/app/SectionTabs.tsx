// SectionTabs — one section, several views. The same pill strip on every page
// of a section (Customers, Insights) so they read as tabs of a single
// destination instead of unrelated pages. Accent follows the domain token.

import { Link, useRouterState } from "@tanstack/react-router";
import {
  Users,
  Workflow,
  Crosshair,
  TrendingUp,
  Activity,
  Hourglass,
  Building2,
  MessageSquare,
  Calendar,
  CheckSquare,
  FileText,
  HeartPulse,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";
import { useIsAdmin } from "@/lib/admin";

interface SectionTab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only shown to platform admins (user_roles.role = 'admin'). */
  adminOnly?: boolean;
}

export interface SectionConfig {
  tabs: readonly SectionTab[];
  /** Domain accent token, e.g. "var(--domain-customers)" */
  accent: string;
}

export const SECTIONS = {
  customers: {
    accent: "var(--domain-customers)",
    tabs: [
      { to: "/app/contacts", label: "People", icon: Users },
      { to: "/app/crm/companies", label: "Companies", icon: Building2 },
      { to: "/app/bylda/crm", label: "Pipeline", icon: Workflow },
      { to: "/app/crm/accounts", label: "Health", icon: HeartPulse },
      { to: "/app/crm/calls", label: "Calls", icon: PhoneCall },
      { to: "/app/crm/conversations", label: "Inbox", icon: MessageSquare },
      { to: "/app/crm/calendar", label: "Calendar", icon: Calendar },
      { to: "/app/crm/tasks", label: "Tasks", icon: CheckSquare },
      { to: "/app/crm/forms", label: "Forms", icon: FileText },
      { to: "/app/launchpad/first-customers", label: "First Customers", icon: Crosshair },
      { to: "/app/crm/waitlist", label: "Waitlist", icon: Hourglass, adminOnly: true },
    ],
  },
  insights: {
    accent: "var(--domain-insights)",
    tabs: [
      { to: "/app/bylda/reports", label: "Reports", icon: TrendingUp },
      { to: "/app/monitoring", label: "System Health", icon: Activity },
    ],
  },
} as const satisfies Record<string, SectionConfig>;

export function SectionTabs({ section }: { section: keyof typeof SECTIONS }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useIsAdmin();
  const { tabs: allTabs, accent } = SECTIONS[section];
  const tabs = allTabs.filter((t: SectionTab) => !t.adminOnly || isAdmin);

  return (
    <div
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      {tabs.map((t) => {
        const active = path === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition"
            style={{
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: active ? "var(--shadow-card)" : "none",
            }}
          >
            <t.icon className="h-3.5 w-3.5" style={active ? { color: accent } : undefined} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
