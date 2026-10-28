/**
 * RepReportPanel — the one-page coaching note for a rep. Generate for a period,
 * read the latest note, browse past ones. Every cited moment links back to the
 * call's Scores tab so the manager can hear the tape before the conversation.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { secondsFromCitation } from "@/lib/coaching/behavior";
import { BehaviorManagerBrief } from "./BehaviorManagerBrief";
import { generateRepReport, markReportDelivered, repReportsQuery } from "@/lib/queries";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value.length === 10 ? `${value}T00:00:00` : value),
  );
}

export function RepReportPanel({
  repId,
  repName,
  onOpenCall,
}: {
  repId: string;
  repName: string;
  onOpenCall: (callId: string, seconds?: number | null) => void;
}) {
  const qc = useQueryClient();
  const reportsQ = useQuery(repReportsQuery(repId));
  const reports = (reportsQ.data ?? []).filter((r) => r.status === "completed" && r.report);
  const [days, setDays] = useState<(typeof PERIODS)[number]["days"]>(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected: RepReportRow | null =
    (selectedId && reports.find((r) => r.id === selectedId)) || reports[0] || null;

  const toggleDelivered = async (row: RepReportRow) => {
    try {
      await markReportDelivered(row.id, !row.delivered_at);
      await qc.invalidateQueries({ queryKey: ["rep-reports", repId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the report");
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await generateRepReport(repId, days);
      await qc.invalidateQueries({ queryKey: ["rep-reports", repId] });
      setSelectedId(res.report_id);
      toast.success(`Report written from ${res.call_count} call${res.call_count === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="lg:col-span-2">
        <BehaviorManagerBrief repId={repId} onOpenCall={onOpenCall} />
      </div>
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
        ) : selected?.report ? (
          <>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => void toggleDelivered(selected)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold ${selected.delivered_at ? "border-[#28764d]/30 bg-[#dff1e7] text-[#28764d]" : "border-black/[0.1] bg-white text-by-text-primary"}`}
                title="Mark when you have had this coaching conversation with the rep"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {selected.delivered_at
                  ? `Conversation marked ${formatDate(selected.delivered_at)}`
                  : "Mark conversation held"}
              </button>
            </div>
            <ReportPage report={selected.report} onOpenCall={onOpenCall} />
          </>
        ) : (
          <p className="mt-6 text-sm text-neutral-500">
            Generate a report once this rep has scored and analyzed calls in the period. It reads
            the learning moments across calls and writes one page: what to coach, with the moments
            to play back and the lines to practice.
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
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-center gap-2 rounded-by-control px-2.5 py-2 text-left text-[12px] ${selected?.id === r.id ? "bg-black/[0.05] font-semibold" : "hover:bg-black/[0.03]"}`}
                >
                  <FileText className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="flex-1">
                    {formatDate(r.period_start)} – {formatDate(r.period_end)}
                  </span>
                  <span className="text-neutral-400">{r.call_count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
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
      <p className="text-[17px] font-medium leading-7 text-[#333943]">{report.headline}</p>

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
        Written from this rep’s scored calls and the assigned playbook. Every moment cited is one
        you can open and hear.
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
  const tone = t.change === null ? "text-neutral-500" : up ? "text-[#28764d]" : "text-[#9b1c1c]";
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
  not_applicable: "–",
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
          className="rounded-by-card bg-black/[0.03] px-3 py-2 text-[12px] leading-5"
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
