import type { BehaviorAnalysis, Evidence } from "@/lib/coaching/types";
import type { ParsedTurn } from "../../../../supabase/functions/_shared/coaching/transcript-parse";
import { timeLabel } from "@/lib/coaching/behavior";
import { buildCallTimeline, TIMELINE_TRACKS, type TimelineTrack } from "@/lib/coaching/timeline";
const colors = {
  rep: "bg-sky-200 text-sky-950",
  customer: "bg-violet-200 text-violet-950",
  strength: "bg-emerald-200 text-emerald-950",
  concern: "bg-amber-200 text-amber-950",
  mixed: "bg-orange-100 text-orange-950",
  neutral: "bg-neutral-200 text-neutral-800",
};
const empty: Record<TimelineTrack, string> = {
  Stage: "No source-linked stage observations in this analysis.",
  Events: "No timed behavioral events in this analysis.",
  Talk: "Speaking duration requires timed transcript turns.",
  Control: "No timed question-and-response pairs identified.",
  Sentiment: "No retained tone annotations for this transcript.",
};
export function FigmaCallTimeline({
  analysis,
  duration,
  turns = [],
  structuredTurns = null,
  onSelect,
}: {
  analysis: BehaviorAnalysis | null;
  duration: number | null;
  turns?: Evidence[];
  structuredTurns?: ParsedTurn[] | null;
  onSelect: (e: Evidence, key: string | null) => void;
}) {
  const timeline = buildCallTimeline(analysis, turns, structuredTurns, duration);
  return (
    <section
      className="rounded-xl border border-by-border-engraved bg-white p-4 text-[11px]"
      aria-label="Call timeline"
    >
      <div className="mb-3 flex flex-wrap justify-between gap-3">
        <span className="uppercase">Call timeline</span>
        <span className="text-by-text-secondary">
          Event times follow retained transcript estimates.
        </span>
      </div>
      {TIMELINE_TRACKS.map((label) => (
        <div
          key={label}
          className="grid min-h-10 grid-cols-[72px_minmax(0,1fr)] items-center gap-3 py-1"
        >
          <span className="uppercase">{label}</span>
          {timeline.tracks[label].length && timeline.duration ? (
            <div
              className="relative h-10 overflow-hidden rounded border border-by-border-engraved bg-by-surface-hover"
              role="group"
              aria-label={`${label} timeline`}
            >
              {timeline.tracks[label].map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  title={`${m.label} · ${timeLabel(m.start)} — ${timeLabel(m.end)}\n${m.detail}`}
                  aria-label={`${label}: ${m.label} at ${timeLabel(m.start)}`}
                  className={`absolute h-[18px] min-w-[6px] overflow-hidden rounded px-1 text-left text-[9px] focus:z-20 focus:outline focus:outline-2 ${colors[m.color]}`}
                  style={{
                    left: `${Math.min(99, (m.start / timeline.duration!) * 100)}%`,
                    width: `${Math.max(0.5, Math.min(100 - (m.start / timeline.duration!) * 100, ((m.end - m.start) / timeline.duration!) * 100))}%`,
                    top:
                      label === "Talk"
                        ? m.evidence.speaker === "customer"
                          ? 20
                          : 0
                        : (i % 2) * 20,
                  }}
                  onClick={() => onSelect(m.evidence, m.occurrence)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded border border-by-border-engraved bg-by-surface-hover px-2 py-1 text-[10px] text-by-text-secondary">
              {empty[label]}
            </p>
          )}
        </div>
      ))}
      <div className="mt-2 flex justify-between pl-[85px] text-by-text-secondary">
        <span>0:00</span>
        <span>{timeline.duration ? timeLabel(timeline.duration) : "No timed transcript"}</span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-by-text-secondary">
        Talk: rep {Math.round(timeline.repSeconds)}s · buyer {Math.round(timeline.buyerSeconds)}s.
        Overlapping speakers can count in both totals; gaps are unmeasured. Control shows who leads
        an explicit question-and-response pair, not sales skill. Sentiment shows retained tone
        estimates, not verified emotion. Stages are observed event spans; gaps are not inferred.
      </p>
      {timeline.untimedEvents > 0 && (
        <p className="mt-1 text-[10px] text-by-text-secondary">
          {timeline.untimedEvents} behavioral events have no retained timestamp; inspect them in
          Analysis.
        </p>
      )}
    </section>
  );
}
