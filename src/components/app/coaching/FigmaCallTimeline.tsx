import type { BehaviorAnalysis, Evidence } from "@/lib/coaching/types";
import { timeLabel } from "@/lib/coaching/behavior";
import { validSourceSeconds } from "@/lib/coaching/source-navigation";
/** Only retained event positions are interactive; unmeasured tracks stay empty. */
export function FigmaCallTimeline({
  analysis,
  duration,
  onSelect,
}: {
  analysis: BehaviorAnalysis | null;
  duration: number | null;
  onSelect: (e: Evidence, key: string) => void;
}) {
  const moments = (analysis?.events ?? []).map((e) => ({
    key: e.occurrence_key,
    family: e.family,
    evidence: [...e.rep_evidence, ...e.buyer_evidence].find((v) => validSourceSeconds(v.start_s)),
  }));
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
      {["Stage", "Events", "Talk", "Control", "Sentiment"].map((label) => (
        <div key={label} className="grid min-h-7 grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
          <span className="uppercase">{label}</span>
          {label === "Events" &&
          moments.some((m) => m.evidence) &&
          validSourceSeconds(duration) &&
          duration > 0 ? (
            <div className="relative h-7 rounded border border-by-border-engraved bg-by-surface-hover">
              {moments.map(
                (m) =>
                  m.evidence && (
                    <button
                      key={m.key}
                      type="button"
                      title={`${m.family.replaceAll("_", " ")} · ${timeLabel(m.evidence.start_s)}`}
                      aria-label={`Open timeline event at ${timeLabel(m.evidence.start_s)}`}
                      className="absolute top-1 h-5 w-3 -translate-x-1/2 rounded bg-by-surface-control-dark"
                      style={{
                        left: `${Math.min(98, Math.max(2, (100 * m.evidence.start_s!) / duration))}%`,
                      }}
                      onClick={() => onSelect(m.evidence!, m.key)}
                    />
                  ),
              )}
            </div>
          ) : (
            <div
              className="flex h-5 items-center justify-center rounded border border-by-border-engraved bg-by-surface-hover text-[10px] text-by-text-tertiary"
              data-unavailable="true"
            >
              Not available yet
            </div>
          )}
        </div>
      ))}
      <div className="mt-2 flex justify-between pl-[85px] text-by-text-secondary">
        <span>0:00</span>
        <span>{validSourceSeconds(duration) ? timeLabel(duration) : "Duration unknown"}</span>
      </div>
    </section>
  );
}
