import { cn } from "@/components/bylda";
import type { OutcomeAssociation } from "@/lib/data";
import {
  CONFIDENCE_LABEL,
  OUTCOME_LABEL,
  OUTCOME_MIN_CLOSED,
  gapPoints,
  pointsLabel,
} from "../shared/outcomes";
import {
  CANVAS_H,
  CANVAS_W,
  EDGES,
  NODES,
  NODE_H,
  NODE_W,
  edgeGeometry,
  labelAnchor,
} from "./schema";

/** Grid spacing — Figma 28:858 draws 24px squares. */
const GRID = 24;
/** Inset of the drawing inside the dark frame. */
const PAD = 8;
const W = CANVAS_W + PAD * 2;
const H = CANVAS_H + PAD * 2 + 24;

/**
 * The line that stays drawn only when the data backs it: "associated · +18 pts · MED · n = 486",
 * or an honest "not enough data" when no behavior × outcome pair clears n_closed 30 at Medium
 * confidence or better. Dashed because it is an association, never a recorded fact.
 */
function associationLabel(link: OutcomeAssociation | null): string {
  if (!link) {
    return `No behavior × outcome pair has ~${OUTCOME_MIN_CLOSED} closed outcomes at Medium confidence yet.`;
  }
  return `${link.behaviorName} → ${OUTCOME_LABEL[link.outcome]} · associated · ${pointsLabel(gapPoints(link))} · ${CONFIDENCE_LABEL[link.confidence]} · n = ${link.nClosed}`;
}

/**
 * I6 canvas (Figma 28:857): dark grid, a box per kind of thing Bylda stores, a line per way they
 * link. Edges are drawn in SVG underneath; nodes and edge labels are positioned over it so the
 * text stays real, selectable text. Fits main at 1440; scrolls sideways when narrower.
 * Nodes show what they hold; BEHAVIOR and OUTCOME show the live pair when one qualifies, and the
 * caption above the canvas spells that pair out with its gap, confidence and n — the edge itself
 * only says "associated", so a long label never sits over the boxes.
 */
export function OutcomeGraph({ link }: { link: OutcomeAssociation | null }) {
  const live: Partial<Record<string, string>> = link
    ? { behavior: link.behaviorName, outcome: OUTCOME_LABEL[link.outcome] }
    : {};
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="type-mono-micro text-by-text-on-dark-muted">LIVE LINK</span>
        <span className="type-ui-small text-by-text-on-dark">{associationLabel(link)}</span>
      </p>
      <div className="overflow-x-auto rounded-by-card border border-by-surface-rail-active">
        <div
          role="img"
          aria-label="Graph of how a rep, call, objection, behavior, outcome and coaching action connect"
          className="relative"
          style={{ width: W, height: H }}
        >
          <svg className="absolute inset-0" width={W} height={H} aria-hidden="true">
            <defs>
              <pattern
                id="outcome-graph-grid"
                width={GRID}
                height={GRID}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M${GRID} 0 V${GRID} M0 ${GRID} H${GRID}`}
                  className="fill-none stroke-by-surface-rail-active"
                  strokeWidth={0.5}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#outcome-graph-grid)" />
            <g transform={`translate(${PAD} ${PAD + 12})`}>
              {EDGES.map((e) => (
                <path
                  key={`${e.from}-${e.to}`}
                  d={edgeGeometry(e.from, e.to, e.route).d}
                  className={
                    e.association
                      ? "fill-none stroke-by-text-on-dark"
                      : "fill-none stroke-by-text-on-dark-muted"
                  }
                  strokeWidth={1}
                  strokeDasharray={e.association ? "4 4" : undefined}
                />
              ))}
            </g>
          </svg>

          <div className="absolute" style={{ left: PAD, top: PAD + 12 }}>
            {EDGES.filter((e) => e.label).map((e) => {
              const at = labelAnchor(e);
              return (
                <span
                  key={`${e.from}-${e.to}-label`}
                  className={cn(
                    "type-mono-micro absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-by-surface-rail px-1 text-by-text-on-dark-muted",
                    at.vertical && "rotate-90",
                  )}
                  style={{ left: at.x, top: at.y }}
                >
                  {e.label}
                </span>
              );
            })}
            {NODES.map((n) => (
              <div
                key={n.kind}
                className="absolute flex flex-col gap-[3px] overflow-hidden rounded-by-control border border-by-text-on-dark-muted bg-by-surface-sidebar px-3.5 py-2.5"
                style={{ left: n.x, top: n.y, width: NODE_W, minHeight: NODE_H }}
              >
                <p className="type-mono-micro text-by-text-on-dark-muted">{n.label}</p>
                <p className="type-ui-small text-by-text-on-dark">{live[n.kind] ?? n.holds}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
