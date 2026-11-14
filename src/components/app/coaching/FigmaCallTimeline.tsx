import { useMemo } from "react";
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
const noTurns: Evidence[] = [];
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
  turns = noTurns,
  structuredTurns = null,
  onSelect,
  position = null,
  activeMoment = null,
}: {
  analysis: BehaviorAnalysis | null;
  duration: number | null;
  turns?: Evidence[];
  structuredTurns?: ParsedTurn[] | null;
  position?: number | null;
  activeMoment?: string | null;
  onSelect: (e: Evidence, key: string | null) => void;
}) {
  const timeline = useMemo(
    () => buildCallTimeline(analysis, turns, structuredTurns, duration),
    [analysis, turns, structuredTurns, duration],
  );
  return (
    <section className="page30-glass page30-timeline" aria-label="Call timeline">
      <div className="mb-3 flex flex-wrap justify-between gap-3">
        <h4>Call timeline</h4>
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
            <div className="page30-timeline-track" role="group" aria-label={`${label} timeline`}>
              {timeline.tracks[label].map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  title={`${m.label} · ${timeLabel(m.start)} — ${timeLabel(m.end)}\n${m.detail}`}
                  aria-label={`${label}: ${m.label} at ${timeLabel(m.start)}`}
                  className={`page30-timeline-marker ${colors[m.color]}`}
                  aria-pressed={m.occurrence !== null ? activeMoment === m.occurrence : undefined}
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
              {position !== null && (
                <span
                  className="page30-timeline-position"
                  aria-hidden="true"
                  style={{ left: `${Math.min(100, (position / timeline.duration) * 100)}%` }}
                />
              )}
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
      {timeline.tracks.Events.length > 0 && (
        <ul className="page30-timeline-events" aria-label="Behavior moments">
          {[...timeline.tracks.Events]
            .sort((a, b) => a.start - b.start)
            .map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  aria-pressed={activeMoment === item.occurrence}
                  onClick={() => onSelect(item.evidence, item.occurrence)}
                >
                  <time className="font-mono">{timeLabel(item.start)}</time> {item.label}
                </button>
              </li>
            ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] leading-5 text-by-text-secondary">
        {timeline.tracks.Talk.length
          ? `Talk: rep ${Math.round(timeline.repSeconds)}s · buyer ${Math.round(timeline.buyerSeconds)}s.`
          : "Talk duration is unavailable because timed speaker turns are missing."}
        Overlapping speakers can count in both totals. Control tracks question-and-response pairs.
        Sentiment uses retained tone estimates. Stage marks show observed spans.
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
