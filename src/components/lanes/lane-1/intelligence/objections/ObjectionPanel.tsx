import { ConfidenceMeter, ContextPanel, DirectionTag } from "@/components/bylda";
import type { ObjectionStat } from "@/lib/data";
import { FactRow } from "../shared/IntelligenceFrame";
import { percent } from "../shared/outcomes";

/**
 * I4 context panel (Figma 28:469): SELECTED · <objection> → confidence + n → facts.
 * Figma's "<objection> · by rep" list, "new phrases this week" and "Add to Objection Library" need
 * per-rep objection data, phrase detection and a library to write to — none exist, and a by-rep
 * list is a peer comparison. So the panel says what it can't show instead of filling the space
 * (LANE_REQUESTS L1-3). Observation only at every confidence: this screen has no action.
 */
export function ObjectionPanel({ stat }: { stat: ObjectionStat }) {
  return (
    <ContextPanel>
      <div className="flex flex-col gap-[18px]">
        <h2 className="type-ui-label text-by-text-primary">
          SELECTED · {stat.label.toUpperCase()}
        </h2>

        <ConfidenceMeter
          level={stat.confidence}
          sampleSize={stat.sampleSize}
          sampleLabel={`n = ${stat.sampleSize} ${stat.sampleSize === 1 ? "objection" : "objections"}`}
        />

        <div>
          <FactRow label="COUNT">{stat.count}</FactRow>
          <FactRow label="SEEN IN">
            {stat.callCount} {stat.callCount === 1 ? "call" : "calls"}
          </FactRow>
          <FactRow label="HELD">
            {stat.handledWellRate != null ? percent(stat.handledWellRate) : "—"}
          </FactRow>
          <FactRow label="TREND">
            <DirectionTag direction={stat.trend} />
          </FactRow>
        </div>

        <p className="type-ui-small text-by-text-secondary">
          Pattern detected across the team’s calls. Who handles it best, and new phrases, aren’t
          tracked yet.
        </p>
      </div>
    </ContextPanel>
  );
}
