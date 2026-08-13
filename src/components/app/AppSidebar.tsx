import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpenText,
  BrainCircuit,
  Database,
  Link2,
  PhoneCall,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { label: "Calls", to: "/app/crm/calls", icon: PhoneCall },
  { label: "Deal memory", to: "/app/memory", icon: BookOpenText },
  { label: "Context beta", to: "/app/context-memory", icon: BrainCircuit },
  { label: "CRM records", to: "/app/contacts", icon: Database },
  { label: "Forecast", to: "/app/bylda/reports", icon: BarChart3 },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { currentOrg, profile, user } = useAuth();
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Sales rep";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden w-[218px] shrink-0 flex-col border-r border-white/[0.08] bg-[#101216] text-white lg:flex">
      <div className="flex h-[68px] items-center border-b border-white/[0.08] px-5">
        <Link to="/app/crm/calls">
          <Logo className="text-white" markClassName="h-8 w-8 rounded-[9px]" />
        </Link>
      </div>
      <div className="px-3 pt-6">
        <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#59616e]">
          Revenue workspace
        </div>
        <nav className="space-y-1">
          {NAV.map(({ label, to, icon: Icon }) => {
            const active = path === to || (to !== "/app/crm/calls" && path.startsWith(`${to}/`));
            return (
              <Link
                key={label}
                to={to}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-medium transition",
                  active
                    ? "bg-white/[0.09] text-white"
                    : "text-[#89919d] hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-[#75a7f0]")} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto p-3">
        <div className="mb-2 space-y-1">
          <Link
            to="/app/integrations"
            className="flex h-9 items-center gap-3 rounded-xl px-3 text-[11px] text-[#7f8793] hover:bg-white/[0.05] hover:text-white"
          >
            <Link2 className="h-4 w-4" />
            Integrations
          </Link>
          <Link
            to="/app/settings"
            className="flex h-9 items-center gap-3 rounded-xl px-3 text-[11px] text-[#7f8793] hover:bg-white/[0.05] hover:text-white"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#294b7b] text-[10px] font-bold text-[#a9c8f7]">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold text-[#eef1f5]">{displayName}</div>
            <div className="truncate text-[9px] text-[#66707e]">
              {currentOrg?.name || "Bylda workspace"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
