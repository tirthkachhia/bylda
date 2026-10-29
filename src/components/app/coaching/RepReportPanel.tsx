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
import { secondsFromCitation } from "@/lib/coaching/behavior";
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
  RepReport,
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]" data-design-screen="rep-reports">
      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-by-border-engraved bg-white p-5 lg:col-span-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-by-avatar-metal text-sm">
          {initials(repName)}
        </span>
        <div className="flex-1">
          <h1 className="text-xl">{repName}</h1>
          <p className="mt-1 text-xs text-by-text-secondary">Rep profile · manager view</p>
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
          <section className="rounded-by-card border border-black/[0.09] bg-by-surface-raised p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold tracking-[-0.02em]">{repName}</h2>
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
                  className="flex h-9 items-center gap-2 rounded-full bg-by-surface-control-dark px-4 text-[11px] font-semibold text-white disabled:opacity-50"
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
                  report={selected.report}
                  onOpenCall={(callId, seconds) => {
                    if (!currentOrgId) return;
                    void requestCallSource(
                      {
                        organizationId: currentOrgId,
                        repId,
                        callId,
                        startSeconds: seconds ?? null,
                        source: { kind: "report", reportId: selected.id },
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

          <aside className="rounded-by-card border border-black/[0.09] bg-by-surface-raised p-4">
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
  report,
  onOpenCall,
}: {
  report: RepReport;
  onOpenCall: (callId: string, seconds?: number | null) => void;
}) {
  return (
    <div className="mt-5 space-y-6">
      <p className="text-[20px] font-normal leading-7 text-by-text-primary">{report.headline}</p>

      {report.since_last && (report.since_last.drill || report.since_last.moved.length > 0) && (
        <SinceLastSection since={report.since_last} />
      )}

      {report.patterns.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            Coach on
          </h3>
          <ol className="mt-2 space-y-5">
            {report.patterns.map((p, i) => (
              <li key={i}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] font-semibold text-neutral-400">
                    {i + 1}.
                  </span>
                  <span className="text-[15px] font-semibold">{p.title}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-neutral-700">{p.what_happened}</p>
                {p.guideline && (
                  <p className="mt-0.5 text-[11px] text-[#4774b5]">Playbook: {p.guideline}</p>
                )}
                <Citations cited={p.cited} onOpenCall={onOpenCall} />
                {p.say_instead && (
                  <p className="mt-2 text-[13px] leading-6 text-[#28764d]">
                    <span className="font-semibold">Say instead:</span> “{p.say_instead}”
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.strength && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            Keep doing
          </h3>
          <p className="mt-1 text-[15px] font-semibold">{report.strength.title}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-700">{report.strength.what_happened}</p>
          <Citations cited={report.strength.cited} onOpenCall={onOpenCall} />
        </section>
      )}

      {(report.drill.focus || report.drill.line_to_practice) && (
        <section className="rounded-by-card border border-[#28764d]/25 bg-[#28764d]/[0.06] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#28764d]">
            This week’s drill
          </h3>
          <p className="mt-1 text-[15px] font-semibold">{report.drill.focus}</p>
          {report.drill.line_to_practice && (
            <p className="mt-1 text-[13px] leading-6 text-neutral-700">
              “{report.drill.line_to_practice}”
            </p>
          )}
        </section>
      )}

      {report.strip.length > 1 && <CallStrip strip={report.strip} onOpenCall={onOpenCall} />}

      <p className="text-[10px] text-neutral-400">
        Written from this rep’s scored calls and the assigned playbook. Citations open the source
        call where available. Missing recordings fall back to transcript evidence.
      </p>
    </div>
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
    <section className="rounded-by-card border border-black/[0.08] bg-black/[0.02] p-4">
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
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500">
        Call by call
      </h3>
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

function Citations({
  cited,
  onOpenCall,
}: {
  cited: ReportCitation[];
  onOpenCall: (callId: string, seconds?: number | null) => void;
}) {
  if (!cited.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {cited.map((c) => (
        <li
          key={`${c.call_id}#${c.exchange_index}`}
          className="rounded-md border border-by-border-engraved bg-by-surface-hover px-3 py-3 text-[12px] leading-5"
        >
          <button
            onClick={() => onOpenCall(c.call_id, secondsFromCitation(c.at))}
            className="font-mono text-[11px] font-semibold text-[#4774b5] hover:underline"
          >
            Open call at {c.at}
          </button>
          <p>
            <span className="font-semibold text-[#474d55]">Rep:</span> {c.rep_text}
          </p>
          {c.customer_text && (
            <p className="text-neutral-600">
              <span className="font-semibold text-[#474d55]">Customer:</span> {c.customer_text}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
