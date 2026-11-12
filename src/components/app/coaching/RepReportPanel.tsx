/**
 * RepReportPanel — the one-page coaching note for a rep. Generate for a period,
 * read the latest note, browse past ones. Every cited moment links back to the
 * source call so the manager can inspect the underlying evidence.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/coaching/calls";
import { requestCallSource } from "@/lib/coaching/source-navigation";
import { reportCitationSeconds } from "@/lib/coaching/behavior";
import { ReportCallEvidence } from "./ReportCallEvidence";
import { BehaviorManagerBrief } from "./BehaviorManagerBrief";
import {
  generateRepReport,
  repReportsQuery,
  markReportDelivered,
  coachingManagerPermissionQuery,
} from "@/lib/queries";
import type { SourceNavigationProps } from "@/lib/coaching/source-navigation";
import type {
  GuidelineTrend,
  RepReportRow,
  ReportCitation,
  SinceLast,
  StripRow,
} from "@/lib/coaching/types";

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
] as const;

export type RepReportPanelProps = SourceNavigationProps & {
  repId: string;
  repName: string;
  initialReportId?: string;
  initialView?: "reports" | "profile";
  onViewChange?: (view: "reports" | "profile") => void;
  onSelectReport?: (id: string) => void;
  initialProfileTab?: "Overview" | "Evidence" | "Trends";
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value.length === 10 ? `${value}T00:00:00` : value),
  );
}

export function RepReportPanel({
  repId,
  repName,
  onOpenCall,
  onOpenSource,
  initialReportId,
  initialView = "reports",
  onViewChange,
  onSelectReport,
  initialProfileTab = "Overview",
}: RepReportPanelProps) {
  const { currentOrgId, user } = useAuth();
  const permission = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""));
  const [view, setView] = useState<"reports" | "profile">(initialView);
  const qc = useQueryClient();
  const reportsQ = useQuery(repReportsQuery(repId));
  const reports = reportsQ.data ?? [];
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(30);
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId ?? null);
  const [busy, setBusy] = useState(false);

  const selected: RepReportRow | null = selectedId
    ? (reports.find((r) => r.id === selectedId) ?? null)
    : (reports[0] ?? null);

  const markHeld = async () => {
    if (!selected || !permission.data || busy) return;
    setBusy(true);
    try {
      await markReportDelivered(selected.id, !selected.delivered_at);
      await qc.invalidateQueries({ queryKey: ["rep-reports", repId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update conversation status");
    } finally {
      setBusy(false);
    }
  };
  const chooseReport = (id: string) => {
    setSelectedId(id);
    onSelectReport?.(id);
  };
  const generate = async () => {
    setBusy(true);
    try {
      const res = await generateRepReport(repId, days);
      await qc.invalidateQueries({ queryKey: ["rep-reports", repId] });
      chooseReport(res.report_id);
      toast.success(`Report written from ${res.call_count} call${res.call_count === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="page30-report-layout"
      data-design-screen="rep-reports"
      style={
        view === "reports" && initialReportId ? { viewTransitionName: "bylda-report" } : undefined
      }
    >
      <header className="page30-glass flex flex-wrap items-center gap-4 p-5 lg:col-span-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-by-avatar-metal text-sm">
          {initials(repName)}
        </span>
        <div className="flex-1">
          <h1 className="page30-profile-title">
            {view === "reports" ? "Coaching report" : repName}
          </h1>
          {view === "reports" && <p className="mt-1 text-xs text-by-text-secondary">{repName}</p>}
        </div>
        <div
          className="inline-flex rounded-lg border border-by-border-engraved bg-by-surface-hover p-1"
          role="group"
          aria-label="Rep workspace view"
        >
          {(
            [
              ["profile", "Overview"],
              ["reports", "Reports"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={view === key}
              onClick={() => {
                setView(key);
                onViewChange?.(key);
              }}
              className={`rounded-md px-3 py-2 text-xs ${view === key ? "bg-white shadow-sm" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {view === "profile" ? (
        <div className="rounded-xl border border-by-border-engraved bg-white p-5 lg:col-span-2">
          <BehaviorManagerBrief
            key={repId}
            repId={repId}
            onOpenCall={onOpenCall}
            onOpenSource={onOpenSource}
            initialTab={initialProfileTab}
          />
        </div>
      ) : (
        <>
          <section className="page30-glass min-w-0 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-by-text-secondary">
                  {selected
                    ? `${formatDate(selected.period_start)} – ${formatDate(selected.period_end)} · ${selected.call_count} call${selected.call_count === 1 ? "" : "s"}`
                    : "No report yet for this rep."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) as typeof days)}
                  className="h-9 rounded-full border border-black/[0.1] bg-white px-3 text-[11px] font-semibold"
                  aria-label="Report period"
                >
                  {PERIODS.map((p) => (
                    <option key={p.days} value={p.days}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void generate()}
                  disabled={busy}
                  className="figma-button page30-primary"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {busy ? "Writing…" : "Generate report"}
                </button>
              </div>
            </div>

            {reportsQ.isLoading ? (
              <p className="mt-6 text-sm text-neutral-500">Loading…</p>
            ) : reportsQ.error ? (
              <p role="alert" className="mt-6 text-sm text-red-700">
                Reports could not load.{" "}
                <button type="button" className="underline" onClick={() => void reportsQ.refetch()}>
                  Retry
                </button>
              </p>
            ) : selected?.status === "running" ? (
              <p role="status" className="mt-6 text-sm text-by-text-secondary">
                This report is being prepared.{" "}
                <button type="button" className="underline" onClick={() => void reportsQ.refetch()}>
                  Refresh status
                </button>
              </p>
            ) : selected?.status === "failed" ? (
              <p role="alert" className="mt-6 text-sm text-red-700">
                {selected.error_message ||
                  "This report could not be generated. Generate a new report to retry."}
              </p>
            ) : selected?.report ? (
              <>
                {permission.data && (
                  <div className="my-4 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markHeld()}
                      className="figma-button"
                    >
                      {selected.delivered_at
                        ? `Conversation marked held · ${formatDate(selected.delivered_at)}`
                        : "Mark conversation held"}
                    </button>
                    <span className="text-xs text-by-text-secondary">Manager recorded</span>
                  </div>
                )}
                <ReportPage
                  key={selected.id}
                  row={selected}
                  report={selected.report}
                  organizationId={currentOrgId}
                  onOpenCall={(callId, seconds, citation) => {
                    if (!currentOrgId) return;
                    const source = citation?.behavior_source;
                    void requestCallSource(
                      {
                        organizationId: currentOrgId,
                        repId,
                        callId,
                        startSeconds: seconds ?? null,
                        source: source
                          ? {
                              kind: "behavior",
                              runId: source.run_id,
                              turnId: source.turn_id,
                              eventId: source.event_id,
                            }
                          : { kind: "report", reportId: selected.id },
                      },
                      { onOpenCall, onOpenSource },
                    ).catch((error) =>
                      toast.error(error instanceof Error ? error.message : "Source unavailable"),
                    );
                  }}
                />
              </>
            ) : (
              <p className="mt-6 text-sm text-neutral-500">
                {selectedId
                  ? "The requested report is unavailable for this rep. Choose another report from history."
                  : "Generate a report once this rep has scored and analyzed calls in the period. Reports include coaching patterns, evidence and a practice drill."}
              </p>
            )}
          </section>

          <aside className="page30-glass p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              Past reports
            </h3>
            {reports.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">None yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {reports.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => chooseReport(r.id)}
                      className={`flex w-full items-center gap-2 rounded-by-control px-2.5 py-2 text-left text-[12px] ${selected?.id === r.id ? "bg-black/[0.05] font-semibold" : "hover:bg-black/[0.03]"}`}
                    >
                      <FileText className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="flex-1">
                        {formatDate(r.period_start)} – {formatDate(r.period_end)}
                      </span>
                      <span className="text-neutral-400">
                        {r.status === "completed" ? r.call_count : r.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function ReportPage({
  row,
  report,
  organizationId,
  onOpenCall,
}: {
  row: RepReportRow;
  report: NonNullable<RepReportRow["report"]>;
  organizationId: string | null;
  onOpenCall: (callId: string, seconds?: number | null, citation?: ReportCitation) => void;
}) {
  const strength = report.strength;
  const entries = [
    ...report.patterns.flatMap((pattern) =>
      pattern.cited.map((citation) => ({
        title: pattern.title,
        guideline: pattern.guideline,
        description: pattern.what_happened,
        action: pattern.say_instead,
        citation,
      })),
    ),
    ...(strength?.cited.map((citation) => ({
      title: strength.title,
      guideline: null,
      description: strength.what_happened,
      action: "",
      citation,
    })) ?? []),
  ];
  const citedCalls = [...new Set(entries.map((item) => item.citation.call_id))];
  const tasks = new Map<string, string>();
  if (report.drill.focus || report.drill.line_to_practice)
    tasks.set(report.drill.line_to_practice || report.drill.focus, report.drill.focus);
  for (const pattern of report.patterns) {
    if (pattern.say_instead && !tasks.has(pattern.say_instead))
      tasks.set(pattern.say_instead, pattern.title);
  }

  return (
    <article className="page30-report" aria-label="Coaching report">
      <header className="page30-report-hero">
        <div>
          <p className="page30-label">Your 30-second read</p>
          <h2>{report.headline || "Your focus for the next calls"}</h2>
        </div>
        <div className="page30-report-count">
          <strong>{row.call_count}</strong>
          <span>Calls reviewed</span>
        </div>
      </header>

      <div className="page30-report-columns">
        <ReportScorecard row={row} citedCalls={citedCalls.length} />
        <section className="page30-glass page30-report-card" aria-label="Five-call plan">
          <h3>Your next 5 calls</h3>
          {tasks.size ? (
            <ol className="page30-plan">
              {[...tasks].map(([action, label]) => (
                <li key={action}>
                  <div>
                    {label && <h4>{label}</h4>}
                    {label !== action && <p>{action}</p>}
                  </div>
                  <span className="page30-plan-calls" aria-label="Practice on calls 1 through 5">
                    {[1, 2, 3, 4, 5].map((call) => (
                      <span key={call} aria-hidden="true">
                        {call}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="page30-muted">This report has no saved practice drill.</p>
          )}
        </section>
      </div>

      {entries.length > 0 && (
        <section className="page30-glass page30-report-card">
          <header className="page30-section-header">
            <h3>What happened, and what to focus on</h3>
            <span className="page30-muted">
              {citedCalls.length} cited {citedCalls.length === 1 ? "call" : "calls"}
            </span>
          </header>
          {citedCalls.map((callId) => {
            const moments = entries
              .filter((item) => item.citation.call_id === callId)
              .sort(
                (a, b) =>
                  (reportCitationSeconds(a.citation) ?? Infinity) -
                  (reportCitationSeconds(b.citation) ?? Infinity),
              );
            return (
              <ol
                key={callId}
                className="page30-moments"
                aria-label="Call evidence in timestamp order"
              >
                {moments.map(({ citation, title, description, guideline, action }, index) => (
                  <li key={`${citation.exchange_index}:${title}:${index}`}>
                    <div className="page30-moment-name">
                      <span className="page30-moment-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <h4>{title}</h4>
                    </div>
                    <ReportCallEvidence
                      citation={citation}
                      organizationId={organizationId}
                      repId={row.rep_id}
                      onOpenCall={onOpenCall}
                    />
                    <div className="page30-moment-focus">
                      <p className="page30-label">{action ? "Focus on" : "What happened"}</p>
                      {action && (
                        <p>
                          <strong>{action}</strong>
                        </p>
                      )}
                      <p>{description}</p>
                      {guideline && <p className="page30-muted">Playbook · {guideline}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            );
          })}
        </section>
      )}

      {strength && !strength.cited.length && (
        <section className="page30-glass page30-report-card">
          <h3>Keep doing</h3>
          <h4>{strength.title}</h4>
          <p>{strength.what_happened}</p>
        </section>
      )}
      {report.since_last && (report.since_last.drill || report.since_last.moved.length > 0) ? (
        <SinceLastSection since={report.since_last} />
      ) : (
        <section className="page30-glass page30-report-card">
          <h3>Change over time</h3>
          <p className="page30-muted">This report has no comparable prior observations.</p>
        </section>
      )}
      {(report.strip?.length ?? 0) > 1 && (
        <CallStrip strip={report.strip} onOpenCall={onOpenCall} />
      )}
    </article>
  );
}

function ReportScorecard({ row, citedCalls }: { row: RepReportRow; citedCalls: number }) {
  const since = row.report?.since_last;
  const changes = new Map(
    [...(since?.moved ?? []), ...(since?.drill ? [since.drill] : [])].map(
      (item) => [item.guideline_id, item.change] as const,
    ),
  );
  const scores = (row.adherence ?? [])
    .flatMap((item) => {
      const judged = item.followed + item.partial + item.missed;
      if (judged <= 0) return [];
      return [
        {
          ...item,
          judged,
          score: Math.round(((item.followed + item.partial / 2) / judged) * 100),
          change: item.guideline_id ? changes.get(item.guideline_id) : undefined,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || b.judged - a.judged);
  return (
    <section className="page30-glass page30-report-card" aria-label="Behavior scorecard">
      <h3>Behavior scorecard</h3>
      <p className="page30-muted">
        {citedCalls} {citedCalls === 1 ? "call" : "calls"} with cited evidence
      </p>
      {scores.length ? (
        <>
          <p className="page30-muted">
            Playbook adherence on judged calls. Partial adherence earns half credit.
          </p>
          <ul className="page30-scorecard">
            {scores.map((score) => (
              <li key={score.guideline_id ?? score.guideline}>
                <div>
                  <strong>{score.guideline}</strong>
                  <span className="page30-muted">
                    {score.followed} of {score.judged} followed
                    {score.partial > 0 && ` · ${score.partial} partial`}
                  </span>
                </div>
                <meter min={0} max={100} value={score.score} aria-label={score.guideline} />
                <strong className="font-mono">{score.score}%</strong>
                {score.change != null && (
                  <span className="page30-muted font-mono">
                    {score.change > 0 ? "+" : ""}
                    {Math.round(score.change * 100)} pp
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="page30-muted">No scored playbook behaviors are saved for this period.</p>
      )}
    </section>
  );
}

const ofCalls = (c: GuidelineTrend["current"]) =>
  c.judged === 0
    ? "not judged"
    : `${c.followed}${c.partial ? ` (+${c.partial} partial)` : ""} of ${c.judged}`;

function TrendLine({ t, label }: { t: GuidelineTrend; label?: string }) {
  const up = (t.change ?? 0) > 0;
  const tone =
    t.change === null || t.change === 0
      ? "text-neutral-500"
      : up
        ? "text-[#28764d]"
        : "text-[#9b1c1c]";
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-6">
      {label && <span className="font-semibold">{label}</span>}
      <span className="font-mono text-[11px] text-neutral-500">{t.code}</span>
      <span>{t.title}:</span>
      <span className={`font-semibold ${tone}`}>{ofCalls(t.current)} calls</span>
      <span className="text-neutral-500">before {ofCalls(t.previous)}</span>
    </li>
  );
}

function SinceLastSection({ since }: { since: SinceLast }) {
  return (
    <section className="page30-glass page30-report-card">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
        Since last report
        {since.previous_period && (
          <span className="ml-2 font-normal normal-case tracking-normal">
            {formatDate(since.previous_period.start)} – {formatDate(since.previous_period.end)} ·{" "}
            {since.calls.previous} call{since.calls.previous === 1 ? "" : "s"}
          </span>
        )}
      </h3>
      <ul className="mt-2 space-y-1">
        {since.drill && <TrendLine t={since.drill} label="Last drill" />}
        {since.moved.map((t) => (
          <TrendLine key={t.guideline_id} t={t} />
        ))}
      </ul>
    </section>
  );
}

const DRILL_LABEL: Record<string, string> = {
  followed: "✓",
  partial: "½",
  missed: "✗",
  not_applicable: "N/A",
  not_observable: "Unknown",
  adapted: "Adapted",
};

function CallStrip({
  strip,
  onOpenCall,
}: {
  strip: StripRow[];
  onOpenCall: (callId: string, seconds?: number | null) => void;
}) {
  const hasDrill = strip.some((s) => s.drill_status);
  return (
    <section className="page30-glass page30-report-card">
      <h3>Call by call</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="text-left text-[10px] uppercase tracking-[0.08em] text-neutral-500">
            <tr>
              <th className="py-1 pr-3 font-semibold">Call</th>
              <th className="py-1 pr-3 font-semibold">Flagged exchanges</th>
              <th className="py-1 pr-3 font-semibold">Review</th>
              {hasDrill && <th className="py-1 font-semibold">Drill</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {strip.map((s) => (
              <tr key={s.call_id}>
                <td className="py-1.5 pr-3">
                  <button
                    onClick={() => onOpenCall(s.call_id)}
                    className="font-mono text-[11px] font-semibold text-[#4774b5] hover:underline"
                  >
                    {s.started_at ? formatDate(s.started_at) : "Open"}
                  </button>
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{s.risk_count}</td>
                <td className="py-1.5 pr-3 capitalize">{s.coaching_value_label}</td>
                {hasDrill && (
                  <td className="py-1.5 font-semibold">
                    {s.drill_status ? DRILL_LABEL[s.drill_status] : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
