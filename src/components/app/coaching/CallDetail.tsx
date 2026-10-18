import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, Clock3, FileText, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { conductMetrics } from "../../../../supabase/functions/_shared/observable-conduct";
import {
  formatDuration,
  formatWhen,
  initials,
  segmentLines,
  type CoachingCall,
} from "@/lib/coaching/calls";
import { CallScores } from "./CallScores";

export type DetailTab = "summary" | "scores" | "transcript";

const TONE_CLASS: Record<string, string> = {
  warm: "bg-[#dff1e7] text-[#28764d]",
  enthusiastic: "bg-[#dff1e7] text-[#28764d]",
  curious: "bg-[#dff1e7] text-[#28764d]",
  hesitant: "bg-[#fdf1d6] text-[#8a5b00]",
  skeptical: "bg-[#fdf1d6] text-[#8a5b00]",
  confused: "bg-[#fdf1d6] text-[#8a5b00]",
  frustrated: "bg-[#fde2e2] text-[#9b1c1c]",
  dismissive: "bg-[#fde2e2] text-[#9b1c1c]",
  rushed: "bg-[#fde2e2] text-[#9b1c1c]",
  neutral: "bg-[#ececea] text-[#5f656d]",
};

type ConductObservation = {
  metric: keyof typeof conductMetrics;
  observation: string;
  evidence_quote: string;
};

type AdherenceItem = {
  code?: string | null;
  guideline: string;
  status: "followed" | "partial" | "missed" | "not_applicable";
  evidence_quote: string;
  note: string;
};

type CoachingPoint = { point: string; evidence_quote: string; playbook_guideline?: string };

const ADHERENCE_CLASS: Record<AdherenceItem["status"], string> = {
  followed: "bg-[#dff1e7] text-[#28764d]",
  partial: "bg-[#fdf1d6] text-[#8a5b00]",
  missed: "bg-[#fde2e2] text-[#9b1c1c]",
  not_applicable: "bg-[#ececea] text-[#5f656d]",
};
const ADHERENCE_LABEL: Record<AdherenceItem["status"], string> = {
  followed: "Followed",
  partial: "Partial",
  missed: "Missed",
  not_applicable: "N/A",
};

/** Header card plus Summary / Transcript tabs for one call. */
export function CallDetail({
  call,
  tab,
  onTab,
  onReanalyze,
  onDelete,
}: {
  call: CoachingCall;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onReanalyze?: (callId: string) => Promise<void>;
  onDelete?: (callId: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    if (!onDelete || deleting) return;
    if (
      !window.confirm(
        "Delete this call? The recording, transcript, scores, and coaching notes for it are removed permanently.",
      )
    )
      return;
    setDeleting(true);
    try {
      await onDelete(call.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the call");
    } finally {
      setDeleting(false);
    }
  }
  const transcript = useMemo(() => segmentLines(call), [call]);
  const hasTone = transcript.some((line) => line.tone);
  const vertical = call.insight?.vertical_insights ?? {};
  const dealInsights = vertical.deal_insights ?? {};
  const observations: ConductObservation[] = vertical.observable_conduct?.observations ?? [];
  const coverage = vertical.analysis_coverage ?? {};
  const playbook: { name: string; version: number } | null = vertical.playbook ?? null;
  const adherence: AdherenceItem[] = vertical.playbook_adherence ?? [];
  const coaching: {
    strengths?: CoachingPoint[];
    improvements?: CoachingPoint[];
    next_call_focus?: string;
  } = vertical.coaching ?? {};
  const [reanalyzing, setReanalyzing] = useState(false);

  async function reanalyze() {
    if (!onReanalyze || reanalyzing) return;
    setReanalyzing(true);
    try {
      await onReanalyze(call.id);
      toast.success("Call re-analyzed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Re-analysis failed");
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <main className="min-w-0 space-y-4">
      <section className="overflow-hidden rounded-by-card border border-black/[0.09] bg-by-surface-raised">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dbe7f8] text-[12px] font-bold text-[#346dbf]">
              {initials(call.contactName)}
            </span>
            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.03em]">{call.contactName}</h2>
              <div className="mt-1 text-[11px] text-[#777d86]">
                {call.dealName ?? call.company} · {call.direction} ·{" "}
                {formatWhen(call.started_at ?? call.created_at)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#737982]">
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDuration(call.duration)}
            </span>
            <span className="rounded-full bg-[#dff1e7] px-2 py-1 font-bold uppercase text-[#28764d]">
              {call.status}
            </span>
            {onReanalyze && call.transcript && (
              <button
                type="button"
                onClick={() => void reanalyze()}
                disabled={reanalyzing}
                className="flex h-8 items-center gap-1.5 rounded-full border border-black/[0.1] bg-by-surface-raised px-3 text-[10px] font-semibold text-by-text-primary disabled:opacity-50"
                title="Run the analysis again, for example after assigning a playbook"
              >
                <RefreshCw className={`h-3 w-3 ${reanalyzing ? "animate-spin" : ""}`} />
                {reanalyzing ? "Re-analyzing…" : "Re-analyze"}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting}
                className="flex h-8 items-center gap-1.5 rounded-full border border-red-200 bg-by-surface-raised px-3 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                title="Delete this call and its recording"
              >
                <Trash2 className="h-3 w-3" />
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-by-card border border-black/[0.09] bg-by-surface-raised">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5">
          <div className="flex h-[58px] items-end gap-6">
            {(["summary", "scores", "transcript"] as const).map((item) => (
              <button
                key={item}
                onClick={() => onTab(item)}
                className={`h-full border-b-2 text-[11px] font-semibold capitalize ${tab === item ? "border-[#3275d8] text-[#1e5faf]" : "border-transparent text-[#7d838c]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <Sparkles className="h-4 w-4 text-[#3275d8]" />
        </div>
        {tab === "scores" ? (
          <CallScores callId={call.id} />
        ) : tab === "summary" ? (
          <div className="space-y-5 p-5 sm:p-6">
            {!call.insight ? (
              <p className="text-sm text-neutral-500">
                {call.transcript ? "Analysis pending." : "No transcript yet."}
              </p>
            ) : (
              <>
                {call.insight.summary && (
                  <p className="text-[14px] leading-7 text-[#333943]">{call.insight.summary}</p>
                )}

                {coaching.next_call_focus && (
                  <div className="rounded-by-card bg-[#e9eef6] px-4 py-3">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4774b5]">
                      Next call
                    </span>
                    <p className="mt-1 text-sm font-medium text-[#333943]">
                      {coaching.next_call_focus}
                    </p>
                  </div>
                )}

                {(playbook || adherence.length > 0) && (
                  <section>
                    <SectionTitle icon={<BookOpen className="h-3.5 w-3.5 text-[#3275d8]" />}>
                      Playbook{playbook ? ` · ${playbook.name} v${playbook.version}` : ""}
                    </SectionTitle>
                    {adherence.length === 0 ? (
                      <p className="mt-2 text-xs text-neutral-500">Nothing judged on this call.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-black/5">
                        {adherence.map((item, index) => (
                          <li key={index} className="flex items-start gap-3 py-2">
                            <span
                              className={`mt-0.5 w-16 shrink-0 rounded-by-pill px-2 py-0.5 text-center text-[9px] font-semibold uppercase ${ADHERENCE_CLASS[item.status]}`}
                            >
                              {ADHERENCE_LABEL[item.status]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                {item.code && (
                                  <span className="mr-1.5 font-mono text-[10px] font-semibold text-neutral-400">
                                    {item.code}
                                  </span>
                                )}
                                {item.guideline}
                              </p>
                              {(item.note || item.evidence_quote) && (
                                <Why note={item.note} quote={item.evidence_quote} />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {((coaching.strengths?.length ?? 0) > 0 ||
                  (coaching.improvements?.length ?? 0) > 0) && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <CoachingList title="Keep doing" tone="good" items={coaching.strengths ?? []} />
                    <CoachingList title="Work on" tone="fix" items={coaching.improvements ?? []} />
                  </div>
                )}

                {observations.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-500 hover:text-neutral-800">
                      Observable conduct · {observations.length}
                      <span className="ml-1 font-normal normal-case tracking-normal group-open:hidden">
                        show
                      </span>
                    </summary>
                    <ul className="mt-2 divide-y divide-black/5">
                      {observations.map((observation, index) => (
                        <li key={index} className="py-2">
                          <p className="text-sm">
                            <span className="font-semibold">
                              {conductMetrics[observation.metric] ?? "Observation"}:
                            </span>{" "}
                            {observation.observation}
                          </p>
                          <Why quote={observation.evidence_quote} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {(dealInsights.primary_risk ||
                  dealInsights.primary_driver ||
                  dealInsights.qualification_reason) && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Insight title="Driver" body={dealInsights.primary_driver} />
                    <Insight title="Risk" body={dealInsights.primary_risk} />
                    <Insight title="Why it advances" body={dealInsights.qualification_reason} />
                  </div>
                )}

                <p className="text-[10px] text-neutral-400">
                  AI-generated from the transcript{coverage.used_tone ? " and audio tone" : ""}.
                  Quotes are verbatim.
                  {coverage.partial
                    ? ` Partial: first ${Number(coverage.analyzed_characters ?? 0).toLocaleString()} of ${Number(coverage.total_characters ?? 0).toLocaleString()} characters.`
                    : ""}
                </p>
              </>
            )}
          </div>
        ) : transcript.length ? (
          <div className="divide-y divide-black/[0.07]">
            {hasTone && (
              <p className="px-5 py-3 text-[11px] text-neutral-500">
                Speaker labels and tone are AI estimates from the audio. They are probabilistic and
                for coaching only.
              </p>
            )}
            {transcript.map((line) => (
              <div
                key={line.key}
                className="grid grid-cols-[35px_minmax(0,1fr)] gap-3 px-5 py-5 text-[12px] leading-6 sm:grid-cols-[50px_140px_minmax(0,1fr)]"
              >
                <span className="font-mono text-[9px] text-[#969ba2]">{line.time}</span>
                <span className="font-semibold text-[#474d55]">
                  {line.speaker}
                  {line.tone && (
                    <span
                      title={line.tone.note || undefined}
                      className={`ml-2 inline-block rounded-by-pill px-2 py-0.5 text-[9px] font-semibold ${TONE_CLASS[line.tone.label] ?? TONE_CLASS.neutral}`}
                    >
                      {line.tone.label}
                    </span>
                  )}
                  {line.overlap && (
                    <span className="ml-2 text-[9px] font-normal text-neutral-400">
                      overlapping
                    </span>
                  )}
                </span>
                <p className="col-span-2 whitespace-pre-wrap break-words text-[#626871] sm:col-span-1">
                  {line.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel
            icon={<FileText className="h-5 w-5" />}
            text="This recording does not have a transcript yet."
          />
        )}
      </section>
    </main>
  );
}

function CoachingList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "fix";
  items: CoachingPoint[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle className={tone === "good" ? "text-[#28764d]" : "text-[#8a5b00]"}>
        {title}
      </SectionTitle>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li key={index}>
            <p className="text-sm">
              {item.point}
              {item.playbook_guideline && (
                <span className="ml-1.5 text-[11px] text-[#4774b5]">
                  · {item.playbook_guideline}
                </span>
              )}
            </p>
            <Why quote={item.evidence_quote} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({
  children,
  icon,
  className = "text-neutral-500",
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${className}`}
    >
      {icon}
      {children}
    </h3>
  );
}

/** Collapsed evidence: the note and verbatim quote behind one small toggle. */
function Why({ note, quote }: { note?: string; quote?: string }) {
  if (!note && !quote) return null;
  return (
    <details className="mt-0.5">
      <summary className="cursor-pointer list-none text-[11px] text-neutral-400 hover:text-neutral-700">
        why
      </summary>
      {note && <p className="mt-1 text-xs text-neutral-600">{note}</p>}
      {quote && (
        <blockquote className="mt-1 border-l-2 border-neutral-200 pl-3 text-xs text-neutral-500">
          “{quote}”
        </blockquote>
      )}
    </details>
  );
}

function Insight({ title, body }: { title: string; body?: string }) {
  if (!body) return null;
  return (
    <article className="rounded-by-card border border-black/[0.08] bg-white p-3">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
        {title}
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-[#333943]">{body}</p>
    </article>
  );
}

function EmptyPanel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-[#858a92]">
      {icon}
      <p className="mt-3 max-w-sm text-[11px] leading-5">{text}</p>
    </div>
  );
}
