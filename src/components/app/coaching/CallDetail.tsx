import { useMemo, type ReactNode } from "react";
import { Clock3, FileText, Sparkles } from "lucide-react";
import { conductMetrics } from "../../../../supabase/functions/_shared/observable-conduct";
import {
  formatDuration,
  formatWhen,
  initials,
  segmentLines,
  type CoachingCall,
} from "@/lib/coaching/calls";

export type DetailTab = "summary" | "transcript";

type ConductObservation = {
  metric: keyof typeof conductMetrics;
  observation: string;
  evidence_quote: string;
};

/** Header card plus Summary / Transcript tabs for one call. */
export function CallDetail({
  call,
  tab,
  onTab,
}: {
  call: CoachingCall;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
}) {
  const transcript = useMemo(() => segmentLines(call), [call]);
  const vertical = call.insight?.vertical_insights ?? {};
  const dealInsights = vertical.deal_insights ?? {};
  const observations: ConductObservation[] = vertical.observable_conduct?.observations ?? [];

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
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-by-card border border-black/[0.09] bg-by-surface-raised">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5">
          <div className="flex h-[58px] items-end gap-6">
            {(["summary", "transcript"] as const).map((item) => (
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
        {tab === "summary" ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-by-card bg-[#e9eef6] p-5">
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4774b5]">
                Bylda’s read
              </div>
              <p className="mt-3 text-[14px] font-medium leading-7 text-[#333943]">
                {call.insight?.summary ??
                  (call.transcript
                    ? "AI analysis is pending for this transcript."
                    : "No transcript is available for this recording yet.")}
              </p>
            </div>
            <div className="mt-5 rounded-by-card border border-black/10 p-5">
              <h3 className="font-serif text-xl">Observable conduct</h3>
              {vertical.analysis_coverage?.partial && (
                <p role="status" className="mt-2 text-xs text-amber-800">
                  Partial analysis: the first 24,000 transcript characters were analyzed. These
                  observations do not cover the whole call.
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                Evidence from what was said and done. Observations are AI-generated and should be
                reviewed.
              </p>
              {observations.map((observation, index) => (
                <div key={index} className="mt-4 border-t border-black/5 pt-3">
                  <h4 className="text-xs font-semibold">
                    {conductMetrics[observation.metric] ?? "Observation"}
                  </h4>
                  <p className="mt-1 text-sm">{observation.observation}</p>
                  <blockquote className="mt-2 border-l-2 border-neutral-200 pl-3 text-xs text-neutral-500">
                    “{observation.evidence_quote}”
                  </blockquote>
                </div>
              ))}
              {!vertical.observable_conduct && (
                <p className="mt-3 text-xs text-neutral-500">
                  Conduct observations appear once the transcript has been analyzed.
                </p>
              )}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Insight title="Why this advances" body={dealInsights.qualification_reason} />
              <Insight title="Primary risk" body={dealInsights.primary_risk} />
              <Insight title="Primary driver" body={dealInsights.primary_driver} />
              <Insight title="Rep coaching" body={dealInsights.coaching_note} />
            </div>
          </div>
        ) : transcript.length ? (
          <div className="divide-y divide-black/[0.07]">
            {transcript.map((line) => (
              <div
                key={line.key}
                className="grid grid-cols-[35px_minmax(0,1fr)] gap-3 px-5 py-5 text-[12px] leading-6 sm:grid-cols-[50px_90px_minmax(0,1fr)]"
              >
                <span className="font-mono text-[9px] text-[#969ba2]">{line.time}</span>
                <span className="font-semibold text-[#474d55]">{line.speaker}</span>
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

function Insight({ title, body }: { title: string; body?: string }) {
  return (
    <article className="rounded-by-card border border-black/[0.08] bg-white p-4">
      <h3 className="text-[11px] font-bold">{title}</h3>
      <p className="mt-2 text-[11px] leading-5 text-[#6d737b]">
        {body || "Not identified in this call."}
      </p>
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
