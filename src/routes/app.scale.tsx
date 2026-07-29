import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { organizationQuery } from "@/lib/queries";
import {
  KanbanSquare,
  Megaphone,
  Zap,
  Users,
  BarChart3,
  Bot,
  ArrowRight,
  Rocket,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/scale")({
  component: ScaleLayout,
});

const SCALE_MODES = [
  {
    id: "pipeline",
    label: "Pipeline",
    desc: "Manage your CRM and leads",
    icon: KanbanSquare,
    color: "#34D399",
    to: "/app/scale/pipeline",
    minStage: "Launch",
  },
  {
    id: "campaigns",
    label: "Campaigns",
    desc: "Marketing assets & sequences",
    icon: Megaphone,
    color: "#7DD3FC",
    to: "/app/scale/campaigns",
    minStage: "Launch",
  },
  {
    id: "automations",
    label: "Automations",
    desc: "Automation modules & webhooks",
    icon: Zap,
    color: "#F5A623",
    to: "/app/scale/automations",
    minStage: "Operate",
  },
  {
    id: "team",
    label: "Team",
    desc: "Members & permissions",
    icon: Users,
    color: "#A78BFA",
    to: "/app/scale/team",
    minStage: "Operate",
  },
  {
    id: "reports",
    label: "Reports",
    desc: "Analytics & performance data",
    icon: BarChart3,
    color: "#FB923C",
    to: "/app/scale/reports",
    minStage: "Launch",
  },
  {
    id: "operators",
    label: "AI Operators",
    desc: "Bylda mentor & AI coaching",
    icon: Bot,
    color: "#0284c7",
    to: "/app/mentor",
    minStage: "Idea",
  },
] as const;

const STAGE_ORDER = ["Idea", "Validate", "Launch", "Operate", "Scale"] as const;

function ScaleLayout() {
  const routerState = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = routerState === "/app/scale" || routerState === "/app/scale/";

  const { currentOrgId } = useAuth();
  const orgQ = useQuery({ ...organizationQuery(currentOrgId ?? ""), enabled: !!currentOrgId });
  const orgStage = (orgQ.data as { stage?: string } | null)?.stage ?? "Idea";
  const stageIdx = STAGE_ORDER.indexOf(orgStage as (typeof STAGE_ORDER)[number]);

  if (isIndex) {
    return <ScaleIndex orgStage={orgStage} stageIdx={stageIdx} />;
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-7rem)]">
      {/* LEFT: Mode nav */}
      <aside className="hidden md:flex flex-col shrink-0 gap-1.5" style={{ width: 200 }}>
        <div
          className="text-[9px] font-bold uppercase tracking-widest mb-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          Scale Operations
        </div>
        {SCALE_MODES.map((mode) => {
          const reqIdx = STAGE_ORDER.indexOf(mode.minStage as (typeof STAGE_ORDER)[number]);
          const isLocked = stageIdx < reqIdx;
          const isActive = routerState.startsWith(mode.to);

          return (
            <Link
              key={mode.id}
              to={mode.to}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all",
                isLocked && "pointer-events-none opacity-40",
              )}
              style={{
                background: isActive
                  ? `color-mix(in oklab, ${mode.color} 12%, var(--surface))`
                  : "transparent",
                border: `1px solid ${isActive ? `color-mix(in oklab, ${mode.color} 35%, transparent)` : "transparent"}`,
              }}
            >
              <mode.icon
                className="h-4 w-4 shrink-0"
                style={{ color: isActive ? mode.color : "var(--muted-foreground)" }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="text-[12px] font-semibold truncate"
                  style={{ color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}
                >
                  {mode.label}
                </div>
              </div>
              {isLocked && <Lock className="h-3 w-3 shrink-0" style={{ color: "#4B5563" }} />}
            </Link>
          );
        })}
      </aside>

      {/* RIGHT: Content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

function ScaleIndex({ orgStage, stageIdx }: { orgStage: string; stageIdx: number }) {
  const isScaleReady = stageIdx >= STAGE_ORDER.indexOf("Launch");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(255,107,26,0.04) 100%)",
          border: "1px solid rgba(245,166,35,0.18)",
        }}
      >
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(245,166,35,0.10) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <div
            className="text-[10px] font-mono font-bold uppercase tracking-widest mb-1"
            style={{ color: "rgba(245,166,35,0.70)" }}
          >
            ● Scale Mode
          </div>
          <h1
            className="font-display text-[22px] font-bold mb-2"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            {isScaleReady ? "Operations Center" : "Scale Mode — Unlocking"}
          </h1>
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            {isScaleReady
              ? "Manage your pipeline, automations, team, and analytics from one operational hub."
              : `You're at the ${orgStage} stage. Reach Launch to activate the full operations suite.`}
          </p>
        </div>
      </div>

      {/* Mode grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCALE_MODES.map((mode) => {
          const reqIdx = STAGE_ORDER.indexOf(mode.minStage as (typeof STAGE_ORDER)[number]);
          const isLocked = stageIdx < reqIdx;

          return (
            <Link
              key={mode.id}
              to={mode.to}
              className={cn(
                "rounded-xl p-5 bylda-card transition-all group relative",
                isLocked ? "pointer-events-none opacity-50" : "bylda-card-hover",
              )}
            >
              {isLocked && (
                <div
                  className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg px-2 py-1"
                  style={{
                    background: "rgba(75,85,99,0.20)",
                    border: "1px solid rgba(75,85,99,0.30)",
                  }}
                >
                  <Lock className="h-3 w-3" style={{ color: "#6B7280" }} />
                  <span className="text-[10px]" style={{ color: "#6B7280" }}>
                    {mode.minStage}+
                  </span>
                </div>
              )}

              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
                style={{
                  background: `color-mix(in oklab, ${mode.color} 12%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${mode.color} 25%, transparent)`,
                }}
              >
                <mode.icon className="h-5 w-5" style={{ color: mode.color }} />
              </div>

              <h3
                className="font-display text-[15px] font-bold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                {mode.label}
              </h3>
              <p className="text-[12px] mb-4" style={{ color: "var(--muted-foreground)" }}>
                {mode.desc}
              </p>

              {!isLocked && (
                <div
                  className="flex items-center gap-1.5 text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: mode.color }}
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {!isScaleReady && (
        <div
          className="rounded-xl p-5 text-center"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <Rocket className="h-8 w-8 mx-auto mb-3" style={{ color: "#F5A623", opacity: 0.7 }} />
          <h3
            className="font-display text-[15px] font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            Reach Launch Stage to unlock Scale Mode
          </h3>
          <p className="text-[12.5px] mb-4" style={{ color: "var(--muted-foreground)" }}>
            Complete the Idea Validation and Offer Creation modules to advance your stage.
          </p>
          <Link
            to="/app/academy"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold btn-execute"
          >
            Continue Academy <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
