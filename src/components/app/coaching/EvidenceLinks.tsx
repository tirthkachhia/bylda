import type { Evidence } from "@/lib/coaching/types";
import { timeLabel } from "@/lib/coaching/behavior";
export function EvidenceLinks({
  evidence,
  onSeek,
  onSelect,
}: {
  evidence: Evidence[];
  onSeek: (seconds: number) => void;
  onSelect?: (evidence: Evidence) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {evidence.map((e) => (
        <li
          key={e.turn_id}
          className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md border border-by-border-engraved bg-by-surface-hover px-3 py-3 text-xs"
        >
          <div>
            <button
              type="button"
              disabled={!onSelect && e.start_s === null}
              onClick={() => {
                if (onSelect) onSelect(e);
                else if (e.start_s !== null) onSeek(e.start_s);
              }}
              className="font-mono underline-offset-4 hover:underline disabled:text-by-text-tertiary"
            >
              {timeLabel(e.start_s)}
            </button>
            <p className="mt-1 text-[10px] uppercase text-by-text-secondary">{e.speaker}</p>
            <span className="text-[9px] text-by-text-tertiary">Turn {e.turn_id}</span>
          </div>
          <blockquote className="whitespace-pre-wrap leading-5">“{e.text}”</blockquote>
        </li>
      ))}
    </ul>
  );
}
