import { SectionTabs } from "@/components/app/SectionTabs";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  deviationAlertsQuery,
  expectedOutcomesQuery,
  openLoopsQuery,
  failedJobsQuery,
  n8nErrorLogQuery,
  acknowledgeAlert,
  resolveAlert,
  type DeviationAlert,
  type ExpectedOutcome,
  type OpenLoop,
  type FailedJob,
  type N8nErrorLogEntry,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  Target,
  Zap,
  XCircle,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/app/monitoring")({
  component: MonitoringPage,
});

const TABS = [
  { key: "alerts", label: "Alerts" },
  { key: "outcomes", label: "Outcomes" },
  { key: "loops", label: "Open Loops" },
  { key: "exceptions", label: "Exceptions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "rgba(248,113,113,0.1)", text: "#F87171", label: "Critical" },
  high: { bg: "rgba(251,146,60,0.1)", text: "#FB923C", label: "High" },
  medium: { bg: "rgba(250,204,21,0.08)", text: "#FBBF24", label: "Medium" },
  low: { bg: "rgba(125,211,252,0.08)", text: "#7DD3FC", label: "Low" },
};

function MonitoringPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("alerts");
  const [acting, setActing] = useState<string | null>(null);

  const alertsQ = useQuery({ ...deviationAlertsQuery(userId), enabled: !!userId });
  const outcomesQ = useQuery({ ...expectedOutcomesQuery(userId), enabled: !!userId });
  const loopsQ = useQuery({ ...openLoopsQuery(userId), enabled: !!userId });
  const jobsQ = useQuery({ ...failedJobsQuery(userId), enabled: !!userId });
  const n8nQ = useQuery({ ...n8nErrorLogQuery() });

  const alerts = alertsQ.data ?? [];
  const openAlerts = alerts.filter((a) => a.status === "open");
  const outcomes = outcomesQ.data ?? [];
  const loops = loopsQ.data ?? [];
  const openLoops = loops.filter((l) => l.status === "open" || l.status === "in_progress");
  const failedJobs = jobsQ.data ?? [];
  const activeJobs = failedJobs.filter((j) => j.status === "pending" || j.status === "retrying");
  const n8nErrors = n8nQ.data ?? [];

  const handleAlertAction = async (alert: DeviationAlert, action: "acknowledge" | "resolve") => {
    if (acting) return;
    setActing(alert.id);
    try {
      if (action === "acknowledge") {
        await acknowledgeAlert(alert.id);
      } else {
        await resolveAlert(alert.id);
      }
      await qc.invalidateQueries({ queryKey: ["deviation_alerts", userId] });
      toast.success(action === "acknowledge" ? "Alert acknowledged" : "Alert resolved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTabs section="insights" />
      {/* Header */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,146,60,0.07) 0%, rgba(167,139,250,0.04) 100%)",
          border: "1px solid rgba(251,146,60,0.18)",
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest mb-1"
            style={{ color: "rgba(251,146,60,0.7)" }}
          >
            <Activity className="h-3 w-3" />
            Monitoring
          </div>
          <h1
            className="font-display text-[22px] font-bold leading-tight"
            style={{ color: "var(--foreground)", letterSpacing: "-0.03em" }}
          >
            Operations health
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted-foreground)" }}>
            {openAlerts.length > 0
              ? `${openAlerts.length} open alert${openAlerts.length !== 1 ? "s" : ""} · `
              : ""}
            {openLoops.length > 0
              ? `${openLoops.length} open loop${openLoops.length !== 1 ? "s" : ""} · `
              : ""}
            {activeJobs.length > 0
              ? `${activeJobs.length} exception${activeJobs.length !== 1 ? "s" : ""} queued`
              : "All systems nominal"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Open Alerts",
            value: openAlerts.length,
            icon: AlertTriangle,
            color: "#FB923C",
            tab: "alerts" as TabKey,
          },
          {
            label: "Tracked Outcomes",
            value: outcomes.length,
            icon: Target,
            color: "#7DD3FC",
            tab: "outcomes" as TabKey,
          },
          {
            label: "Open Loops",
            value: openLoops.length,
            icon: RefreshCw,
            color: "#A78BFA",
            tab: "loops" as TabKey,
          },
          {
            label: "Failed Jobs",
            value: activeJobs.length,
            icon: Zap,
            color: "#F87171",
            tab: "exceptions" as TabKey,
          },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setTab(stat.tab)}
            className={cn(
              "rounded-xl p-4 bylda-card text-left transition-all hover:ring-1",
              tab === stat.tab && "ring-1",
            )}
            style={
              tab === stat.tab
                ? ({ "--tw-ring-color": stat.color } as React.CSSProperties)
                : undefined
            }
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </span>
              <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color, opacity: 0.7 }} />
            </div>
            <div
              className="font-mono font-black text-[24px] leading-none"
              style={{ color: stat.value > 0 ? stat.color : "var(--muted-foreground)" }}
            >
              {stat.value}
            </div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Content */}
      {tab === "alerts" && (
        <AlertsTab alerts={alerts} acting={acting} onAction={handleAlertAction} />
      )}
      {tab === "outcomes" && <OutcomesTab outcomes={outcomes} />}
      {tab === "loops" && <LoopsTab loops={loops} />}
      {tab === "exceptions" && <ExceptionsTab failedJobs={failedJobs} n8nErrors={n8nErrors} />}
    </div>
  );
}

/* ─── Alerts tab ──────────────────────────────────────────────────────── */

function AlertsTab({
  alerts,
  acting,
  onAction,
}: {
  alerts: DeviationAlert[];
  acting: string | null;
  onAction: (a: DeviationAlert, action: "acknowledge" | "resolve") => void;
}) {
  if (alerts.length === 0) {
    return <EmptyCard icon={AlertTriangle} message="No alerts yet — monitoring is active" />;
  }
  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const sev = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
        return (
          <div key={alert.id} className="bylda-card rounded-xl p-4 space-y-2.5">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider shrink-0"
                style={{ background: sev.bg, color: sev.text }}
              >
                {sev.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">{alert.title}</div>
                {alert.diagnosis && (
                  <p
                    className="text-[11.5px] mt-0.5 leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {alert.diagnosis}
                  </p>
                )}
              </div>
              <StatusDot status={alert.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10.5px]" style={{ color: "var(--muted-foreground)" }}>
                {new Date(alert.triggered_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {alert.status === "open" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onAction(alert, "acknowledge")}
                    disabled={!!acting}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50"
                    style={{ background: "rgba(251,146,60,0.1)", color: "#FB923C" }}
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => onAction(alert, "resolve")}
                    disabled={!!acting}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50"
                    style={{ background: "rgba(52,211,153,0.08)", color: "#34D399" }}
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Outcomes tab ────────────────────────────────────────────────────── */

function OutcomesTab({ outcomes }: { outcomes: ExpectedOutcome[] }) {
  if (outcomes.length === 0) {
    return (
      <EmptyCard
        icon={Target}
        message="No tracked outcomes yet — add targets in your memory module"
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {outcomes.map((o) => (
        <div key={o.id} className="bylda-card rounded-xl p-4">
          <div className="text-[12.5px] font-medium truncate">{o.metric_name}</div>
          <div className="font-mono text-[20px] font-bold mt-1" style={{ color: "#7DD3FC" }}>
            {o.target_value}
            {o.target_unit && (
              <span className="text-[12px] font-normal ml-1 text-muted-foreground">
                {o.target_unit}
              </span>
            )}
          </div>
          <div className="text-[10.5px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>
            Target by{" "}
            {new Date(o.check_date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Open Loops tab ──────────────────────────────────────────────────── */

function LoopsTab({ loops }: { loops: OpenLoop[] }) {
  if (loops.length === 0) {
    return <EmptyCard icon={RefreshCw} message="No open loops — everything is resolved" />;
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...loops].sort(
    (a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4),
  );

  return (
    <div className="space-y-3">
      {sorted.map((loop) => {
        const color =
          loop.priority === "critical"
            ? "#F87171"
            : loop.priority === "high"
              ? "#FB923C"
              : loop.priority === "medium"
                ? "#FBBF24"
                : "#7DD3FC";
        const isOpen = loop.status === "open" || loop.status === "in_progress";
        return (
          <div key={loop.id} className="bylda-card rounded-xl p-4 flex items-start gap-3">
            {isOpen ? (
              <Circle className="h-4 w-4 shrink-0 mt-0.5" style={{ color }} />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#34D399" }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium">{loop.title}</div>
              {loop.description && (
                <p className="text-[11.5px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {loop.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color }}
                >
                  {loop.priority}
                </span>
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {loop.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Exceptions tab ─────────────────────────────────────────────────── */

function ExceptionsTab({
  failedJobs,
  n8nErrors,
}: {
  failedJobs: FailedJob[];
  n8nErrors: N8nErrorLogEntry[];
}) {
  const hasAnything = failedJobs.length > 0 || n8nErrors.length > 0;
  if (!hasAnything) {
    return <EmptyCard icon={CheckCircle2} message="No exceptions — queue is clear" />;
  }

  return (
    <div className="space-y-6">
      {/* Failed jobs retry queue */}
      {failedJobs.length > 0 && (
        <section className="space-y-3">
          <div
            className="text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            Retry queue ({failedJobs.length})
          </div>
          {failedJobs.map((job) => (
            <div key={job.id} className="bylda-card rounded-xl p-4 flex items-center gap-3">
              <JobStatusIcon status={job.status} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{job.tool_slug}</div>
                {job.error_message && (
                  <p
                    className="text-[11px] mt-0.5 truncate"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {job.error_message}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <div
                  className="text-[10.5px] font-mono font-semibold"
                  style={{
                    color:
                      job.status === "dead"
                        ? "#F87171"
                        : job.status === "resolved"
                          ? "#34D399"
                          : "#FB923C",
                  }}
                >
                  {job.status}
                </div>
                <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  Retry #{job.retry_count}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* n8n workflow errors */}
      {n8nErrors.length > 0 && (
        <section className="space-y-3">
          <div
            className="text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            Workflow errors ({n8nErrors.length})
          </div>
          {n8nErrors.map((err) => (
            <div key={err.id} className="bylda-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-[12.5px] font-medium truncate">{err.workflow_name}</span>
                <span
                  className="ml-auto text-[10.5px] shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {new Date(err.occurred_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              {err.error_message && (
                <p
                  className="text-[11.5px] leading-relaxed"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {err.error_message}
                </p>
              )}
              {err.error_node && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="text-[10px] rounded-md px-1.5 py-0.5"
                    style={{ background: "rgba(248,113,113,0.08)", color: "#F87171" }}
                  >
                    node: {err.error_node}
                  </span>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  if (status === "resolved")
    return <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#34D399" }} />;
  if (status === "acknowledged")
    return <Clock className="h-4 w-4 shrink-0" style={{ color: "#FB923C" }} />;
  return <Circle className="h-4 w-4 shrink-0" style={{ color: "#F87171" }} />;
}

function JobStatusIcon({ status }: { status: string }) {
  if (status === "resolved")
    return <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#34D399" }} />;
  if (status === "dead")
    return <XCircle className="h-4 w-4 shrink-0" style={{ color: "#F87171" }} />;
  return <RefreshCw className="h-4 w-4 shrink-0" style={{ color: "#FB923C" }} />;
}

function EmptyCard({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="bylda-card rounded-xl p-12 text-center">
      <Icon className="h-8 w-8 mx-auto mb-3 opacity-25" />
      <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        {message}
      </p>
    </div>
  );
}
