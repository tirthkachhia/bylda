import { DirectionTag, cn } from "@/components/bylda";
import type { ObjectionStat } from "@/lib/data";
import { CONFIDENCE_LABEL, percent } from "../shared/outcomes";

/**
 * I4 OBJECTION TYPES table (Figma 28:493). One row per objection with how often it came up, which
 * way it is moving, how often it was handled well, and how sure Bylda is (confidence + n, on
 * every row). Selecting a row fills the context panel.
 * GAP: Figma's TREND sparkline, BEST HANDLER and WHAT WORKS have no field — `ObjectionStat`
 * carries a direction only, and a named "best handler" is a peer comparison (LANE_REQUESTS L1-3).
 */
export function ObjectionsTable({
  stats,
  selectedLabel,
  onSelect,
}: {
  stats: ObjectionStat[];
  selectedLabel: string | null;
  onSelect: (label: string) => void;
}) {
  const total = stats.reduce((n, s) => n + s.count, 0);
  return (
    <section
      aria-label="Objection types"
      className="overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised"
    >
      <header className="flex items-center gap-2 border-b border-by-border-engraved px-4 py-3">
        <h2 className="type-ui-label flex-1 text-by-text-primary">OBJECTION TYPES</h2>
        <span className="type-mono-micro text-by-text-tertiary">{total} objections</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="type-mono-micro border-b border-by-border-engraved bg-by-surface-inset text-by-text-tertiary">
              <th scope="col" className="px-4 py-[9px] font-medium">
                OBJECTION
              </th>
              <th scope="col" className="w-[70px] py-[9px] font-medium">
                COUNT
              </th>
              <th scope="col" className="w-[110px] py-[9px] font-medium">
                TREND
              </th>
              <th scope="col" className="w-[70px] py-[9px] font-medium">
                HELD
              </th>
              <th scope="col" className="w-[140px] py-[9px] pr-4 font-medium">
                CONFIDENCE
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const selected = s.label === selectedLabel;
              return (
                <tr
                  key={s.label}
                  className={cn(
                    "border-b border-by-border-engraved last:border-b-0 transition-colors duration-200 ease-out",
                    selected ? "bg-by-surface-inset" : "hover:bg-by-surface-hover",
                  )}
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(s.label)}
                      className="type-ui-body-strong text-left text-by-text-primary"
                    >
                      {s.label}
                    </button>
                  </th>
                  <td className="type-mono-data text-by-text-secondary">{s.count}</td>
                  <td>
                    <DirectionTag direction={s.trend} />
                  </td>
                  <td className="type-mono-data text-by-text-secondary">
                    {s.handledWellRate != null ? percent(s.handledWellRate) : "—"}
                  </td>
                  <td className="type-mono-micro whitespace-nowrap pr-4 text-by-text-secondary">
                    {CONFIDENCE_LABEL[s.confidence]} · n = {s.sampleSize}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
