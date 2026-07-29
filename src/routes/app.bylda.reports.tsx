import { WeeklyReviewCard } from "@/components/app/WeeklyReviewCard";
import { ModuleBoundary } from "@/components/app/ModuleBoundary";
import { SectionTabs } from "@/components/app/SectionTabs";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { useAuth } from "@/lib/auth";
import { toolRunsQuery, usageQuery, leadsQuery, roiAnalyticsQuery } from "@/lib/queries";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Activity,
  Users,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/bylda/reports")({ component: Reports });

const TABS = [
  { key: "activity", label: "Activity" },
  { key: "roi", label: "ROI Analytics" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function Reports() {
  const { currentOrgId } = useAuth();
  const orgId = currentOrgId ?? "";
  const [tab, setTab] = useState<TabKey>("activity");

  const runsQ = useQuery({ ...toolRunsQuery(orgId, 100), enabled: !!orgId });
  const usageQ = useQuery({ ...usageQuery(orgId), enabled: !!orgId });
  const leadsQ = useQuery({ ...leadsQuery(orgId), enabled: !!orgId });
  const roiQ = useQuery({ ...roiAnalyticsQuery(orgId), enabled: !!orgId });

  const runs = runsQ.data ?? [];
  const usage = usageQ.data ?? [];
  const leads = leadsQ.data ?? [];
  const roi = roiQ.data;

  const totalGens = usage.reduce((s, r) => s + (r.count as number), 0);
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const successRate = runs.length ? Math.round((succeeded / runs.length) * 100) : 0;

  const wonValue = leads
    .filter((l) => l.stage === "Won")
    .reduce((s, l) => s + (Number(l.value) || 0), 0);
  const openPipeline = leads
    .filter((l) => l.stage !== "Lost" && l.stage !== "Won")
    .reduce((s, l) => s + (Number(l.value) || 0), 0);

  const sortedUsage = [...usage].sort((a, b) => (b.count as number) - (a.count as number));
  const maxCount = sortedUsage[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <SectionTabs section="insights" />
      <PageHeader
        eyebrow="Insights"
        title="Reporting"
        description="Your weekly operating review, AI throughput, pipeline performance, and ROI."
      />

      <ModuleBoundary name="weekly review">
        <WeeklyReviewCard />
      </ModuleBoundary>

      {/* Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Activity} label="Generations (mo)" value={totalGens.toLocaleString()} />
        <KPI icon={CheckCircle2} label="Success rate" value={`${successRate}%`} accent="emerald" />
        <KPI icon={Users} label="Open pipeline" value={`$${openPipeline.toLocaleString()}`} />
        <KPI
          icon={BarChart3}
          label="Won value"
          value={`$${wonValue.toLocaleString()}`}
          accent="primary"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition",
              tab === t.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "activity" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="font-display text-[14px] font-semibold tracking-tight">
              Usage by tool
            </div>
            <div className="mt-4 space-y-2.5">
              {sortedUsage.length === 0 && (
                <div className="text-[12.5px] text-muted-foreground">No usage this month yet.</div>
              )}
              {sortedUsage.map((u) => {
                const pct = maxCount ? ((u.count as number) / maxCount) * 100 : 0;
                return (
                  <div key={u.id}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="truncate text-foreground">{u.tool_key}</span>
                      <span className="font-mono text-muted-foreground">{u.count}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="font-display text-[14px] font-semibold tracking-tight">Run health</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Succeeded" value={succeeded} icon={CheckCircle2} tone="emerald" />
              <Stat label="Failed" value={failed} icon={XCircle} tone="rose" />
            </div>
            <div className="mt-5">
              {runs.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={Activity}
                  title="No runs yet"
                  description="Activity will appear here once you generate your first output."
                  className="py-6"
                />
              ) : (
                <div className="space-y-1.5">
                  {runs.slice(0, 6).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-[12px]">
                      <span className="truncate text-foreground/90">{r.tool_key}</span>
                      <span
                        className={
                          "ml-3 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                          (r.status === "succeeded"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : r.status === "failed"
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-amber-500/10 text-amber-400")
                        }
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "roi" && roi && (
        <div className="space-y-6">
          {/* ROI summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RoiCard
              icon={Clock}
              label="Time saved"
              value={`${roi.totalTimeSavedHrs}h`}
              color="#A78BFA"
              sublabel="estimated"
            />
            <RoiCard
              icon={Zap}
              label="Tool runs"
              value={roi.totalToolRuns.toString()}
              color="#7DD3FC"
              sublabel="succeeded"
            />
            <RoiCard
              icon={Activity}
              label="Active automations"
              value={roi.activeAutomations.toString()}
              color="#34D399"
              sublabel="of 6 systems"
            />
            <RoiCard
              icon={TrendingUp}
              label="Won value"
              value={`$${roi.wonLeadsValue.toLocaleString()}`}
              color="#F5A623"
              sublabel="closed deals"
            />
          </div>

          {/* Breakdown by category */}
          {Object.keys(roi.runsByCategory).length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="font-display text-[14px] font-semibold tracking-tight mb-4">
                Runs by category
              </div>
              <div className="space-y-3">
                {Object.entries(roi.runsByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => {
                    const maxCatCount = Math.max(...Object.values(roi.runsByCategory));
                    const pct = maxCatCount ? (count / maxCatCount) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="capitalize text-foreground">{cat}</span>
                          <span className="font-mono text-muted-foreground">{count} runs</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: "linear-gradient(90deg, var(--primary), var(--accent))",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            Time-saved estimates are heuristic (validate: 45 min/run · plan: 90 min · customers: 60
            min · launch: 75 min · funding: 120 min). Won value from closed leads.
          </p>
        </div>
      )}
    </div>
  );
}

function RoiCard({
  icon: Icon,
  label,
  value,
  color,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color, opacity: 0.8 }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="font-mono font-black text-[22px] leading-none" style={{ color }}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "primary" | "emerald";
}) {
  const tone =
    accent === "primary"
      ? "text-primary"
      : accent === "emerald"
        ? "text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={"mt-1 font-display text-xl font-semibold tracking-tight " + tone}>
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "rose";
}) {
  const cls = tone === "emerald" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={"h-3 w-3 " + cls} /> {label}
      </div>
      <div className={"mt-1 font-display text-lg font-semibold " + cls}>{value}</div>
    </div>
  );
}
