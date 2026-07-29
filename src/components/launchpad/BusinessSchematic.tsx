/**
 * BusinessSchematic — the signature Atelier Blueprint component.
 * Renders the business as a technical drawing: every area is a block whose
 * stroke style is a truthful readout of real data —
 *
 *   sealed      solid outline + tint   ≥1 succeeded tool run in the area
 *   drafting    dashed marching ants   a run is in-flight or Bylda's next
 *                                      recommended move targets the area
 *   not-built   dotted ghost           nothing has touched the area yet
 *
 * Areas map 1:1 to the real tool catalog categories (validate / plan /
 * launch / customers / funding) plus the CRM pipeline (leads table).
 * No hardcoded statuses — everything is derived from props.
 *
 * The plotter draw-in sequence runs once per session per business
 * (sessionStorage gate), staggered in dependency order.
 */

import { useMemo } from "react";
import { launchpadCatalog } from "@/lib/mock";
import { LAUNCHPAD_TOOLS } from "@/lib/catalog";

/* ─── Data derivation ────────────────────────────────────────── */

export type AreaState = "sealed" | "drafting" | "ghost";

export interface AreaStatus {
  id: string;
  label: string;
  state: AreaState;
  /** short casefile id shown on sealed blocks */
  sealRef?: string;
  /** one-line unlock note for ghost blocks */
  unlockNote?: string;
}

interface ToolRunLite {
  id: string;
  tool_key: string;
  status: string;
}

export interface SchematicInput {
  toolRuns: ToolRunLite[];
  leadsCount: number;
  /** Bylda's current top recommendation (reused from recommendTools — not refetched) */
  nextMove?: { slug: string; reason: string } | null;
}

/** category ← toolKey lookup built from the two existing catalogs */
function buildCategoryByToolKey(): Map<string, string> {
  const categoryBySlug = new Map<string, string>();
  for (const t of LAUNCHPAD_TOOLS) categoryBySlug.set(t.slug, t.category);
  const map = new Map<string, string>();
  for (const t of launchpadCatalog) {
    const cat = categoryBySlug.get(t.key);
    if (cat) {
      map.set(t.toolKey, cat);
      map.set(t.key, cat); // some runs store the slug as tool_key
    }
  }
  return map;
}

const AREA_DEFS: Array<{
  id: string;
  label: string;
  category: string | null; // null = not tool-driven (pipeline)
  unlockNote: string;
}> = [
  { id: "idea", label: "IDEA", category: "validate", unlockNote: "run Idea Validation" },
  { id: "offer", label: "OFFER", category: "plan", unlockNote: "run a positioning tool" },
  { id: "launch", label: "LAUNCH ASSETS", category: "launch", unlockNote: "build a launch asset" },
  {
    id: "customers",
    label: "CUSTOMERS",
    category: "customers",
    unlockNote: "run First 10 Customers",
  },
  { id: "pipeline", label: "PIPELINE", category: null, unlockNote: "log your first lead" },
  { id: "revenue", label: "REVENUE", category: "funding", unlockNote: "sealed by funding tools" },
  // TODO(data): no live revenue/KPI source exists per-org yet — the Revenue
  // block currently seals from funding-category runs only.
];

export function deriveAreaStatuses({
  toolRuns,
  leadsCount,
  nextMove,
}: SchematicInput): AreaStatus[] {
  const catByKey = buildCategoryByToolKey();
  const nextMoveCategory = nextMove
    ? (LAUNCHPAD_TOOLS.find((t) => t.slug === nextMove.slug)?.category ?? null)
    : null;

  const succeededByCat = new Map<string, string>(); // category → latest run id
  const runningCats = new Set<string>();
  for (const r of toolRuns) {
    const cat = catByKey.get(r.tool_key);
    if (!cat) continue;
    if (r.status === "succeeded" && !succeededByCat.has(cat)) succeededByCat.set(cat, r.id);
    if (r.status === "running" || r.status === "queued") runningCats.add(cat);
  }

  return AREA_DEFS.map((def) => {
    // Pipeline is CRM-driven, not tool-driven
    if (def.id === "pipeline") {
      if (leadsCount > 0)
        return {
          id: def.id,
          label: def.label,
          state: "sealed" as const,
          sealRef: `${leadsCount} LEADS`,
        };
      if (succeededByCat.has("customers"))
        return { id: def.id, label: def.label, state: "drafting" as const };
      return { id: def.id, label: def.label, state: "ghost" as const, unlockNote: def.unlockNote };
    }

    const cat = def.category!;
    const sealedRun = succeededByCat.get(cat);
    if (sealedRun)
      return {
        id: def.id,
        label: def.label,
        state: "sealed" as const,
        sealRef: sealedRun.slice(0, 6).toUpperCase(),
      };
    if (runningCats.has(cat) || nextMoveCategory === cat)
      return { id: def.id, label: def.label, state: "drafting" as const };
    return { id: def.id, label: def.label, state: "ghost" as const, unlockNote: def.unlockNote };
  });
}

/**
 * Adapter: build schematic input straight from the Business Graph — the
 * read model Mission Control already loads. No extra queries; the sealed
 * annotation references the sealing tool key (per-run ids aren't in the
 * graph's signals).
 */
export function schematicInputFromGraph(graph: {
  signals: { succeededToolKeys: string[]; leadCount: number };
  recommendations: Array<{ title: string; to: string }>;
}): SchematicInput {
  const rec = graph.recommendations[0];
  const slugMatch = rec?.to.match(/^\/app\/launchpad\/([^/?]+)/);
  return {
    toolRuns: graph.signals.succeededToolKeys.map((k) => ({
      id: k,
      tool_key: k,
      status: "succeeded",
    })),
    leadsCount: graph.signals.leadCount,
    nextMove: rec && slugMatch ? { slug: slugMatch[1], reason: rec.title } : null,
  };
}

/* ─── Geometry ───────────────────────────────────────────────── */

const BLOCKS: Record<string, { x: number; y: number; w: number; h: number }> = {
  idea: { x: 20, y: 30, w: 180, h: 70 },
  offer: { x: 230, y: 30, w: 180, h: 70 },
  launch: { x: 440, y: 30, w: 180, h: 70 },
  customers: { x: 230, y: 170, w: 180, h: 70 },
  pipeline: { x: 440, y: 170, w: 180, h: 70 },
  revenue: { x: 440, y: 310, w: 180, h: 70 },
};

// Real dependency wires: idea feeds offer, offer feeds launch assets +
// customers, launch assets feed customers, customers feed pipeline,
// pipeline feeds revenue. Mirrors the lane playlists in recommendTools.
const WIRES: Array<{ from: string; to: string; d: string }> = [
  { from: "idea", to: "offer", d: "M200,65 H230" },
  { from: "offer", to: "launch", d: "M410,65 H440" },
  { from: "offer", to: "customers", d: "M320,100 V170" },
  { from: "launch", to: "customers", d: "M530,100 V135 H360 V170" },
  { from: "customers", to: "pipeline", d: "M410,205 H440" },
  { from: "pipeline", to: "revenue", d: "M530,240 V310" },
];

// Plotter draw order (dependency order)
const DRAW_ORDER = ["idea", "offer", "launch", "customers", "pipeline", "revenue"];

/* ─── Presentation ───────────────────────────────────────────── */

const STROKE: Record<AreaState, { stroke: string; dash?: string; fill: string }> = {
  sealed: { stroke: "var(--color-blueprint-blue)", fill: "var(--color-blueprint-signal-soft)" },
  drafting: { stroke: "var(--color-blueprint-signal)", dash: "6 5", fill: "var(--color-panel)" },
  ghost: { stroke: "var(--color-ink-faint)", dash: "2 4", fill: "transparent" },
};

interface BusinessSchematicProps extends SchematicInput {
  orgId: string;
}

export function BusinessSchematic({
  orgId,
  toolRuns,
  leadsCount,
  nextMove,
}: BusinessSchematicProps) {
  const areas = useMemo(
    () => deriveAreaStatuses({ toolRuns, leadsCount, nextMove }),
    [toolRuns, leadsCount, nextMove],
  );

  // Draw-in runs once per session per business
  const shouldAnimate = useMemo(() => {
    if (typeof window === "undefined") return false;
    const key = `bp-schematic-drawn:${orgId}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  }, [orgId]);

  const draftingArea = areas.find((a) => a.state === "drafting");
  const byId = new Map(areas.map((a) => [a.id, a]));

  const isLive = (id: string) => {
    const s = byId.get(id)?.state;
    return s === "sealed" || s === "drafting";
  };

  return (
    <div className="border-2 border-ink bg-blueprint-grid">
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 640 420"
          role="img"
          aria-label="Live schematic of your business: each block shows whether that area is sealed, being drafted, or not built yet"
          className="block h-auto w-full min-w-[560px]"
        >
          {/* Wires first so blocks sit on top */}
          {WIRES.map((w, i) => {
            const live = isLive(w.from) && isLive(w.to);
            return (
              <path
                key={`${w.from}-${w.to}`}
                d={w.d}
                fill="none"
                stroke={live ? "var(--color-blueprint-signal)" : "var(--color-ink-faint)"}
                strokeWidth={live ? 1.5 : 1}
                strokeDasharray={live ? undefined : "2 4"}
                className={shouldAnimate ? "animate-draw" : undefined}
                style={
                  shouldAnimate
                    ? {
                        strokeDasharray: live ? 400 : undefined,
                        strokeDashoffset: live ? 400 : 0,
                        animationDelay: `${(DRAW_ORDER.indexOf(w.from) + 1) * 180 + 90}ms`,
                      }
                    : undefined
                }
              />
            );
          })}

          {areas.map((area) => {
            const b = BLOCKS[area.id];
            const s = STROKE[area.state];
            const drawDelay = `${DRAW_ORDER.indexOf(area.id) * 180}ms`;
            const perimeter = 2 * (b.w + b.h);
            return (
              <g key={area.id}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill={s.fill}
                  stroke={s.stroke}
                  strokeWidth={area.state === "sealed" ? 2 : 1.5}
                  strokeDasharray={s.dash}
                  className={
                    area.state === "drafting"
                      ? "animate-march"
                      : shouldAnimate
                        ? "animate-draw"
                        : undefined
                  }
                  style={
                    shouldAnimate && area.state !== "drafting"
                      ? {
                          strokeDasharray: perimeter,
                          strokeDashoffset: perimeter,
                          animationDelay: drawDelay,
                        }
                      : undefined
                  }
                />
                {/* Blinking cursor at the trailing edge of a drafting block */}
                {area.state === "drafting" && (
                  <rect
                    x={b.x + b.w - 10}
                    y={b.y + b.h - 18}
                    width={5}
                    height={11}
                    fill="var(--color-blueprint-signal)"
                    className="animate-pulse"
                    aria-hidden="true"
                  />
                )}
                <text
                  x={b.x + 12}
                  y={b.y + 26}
                  className="font-tech"
                  fontSize={13}
                  fontWeight={700}
                  fill={area.state === "ghost" ? "var(--color-ink-faint)" : "var(--color-ink)"}
                  letterSpacing="0.06em"
                >
                  {area.label}
                </text>
                {area.state === "sealed" && (
                  <text
                    x={b.x + 12}
                    y={b.y + 46}
                    className="font-bp-mono"
                    fontSize={9}
                    fill="var(--color-blueprint-seal)"
                    letterSpacing="0.08em"
                  >
                    ✓ SEALED · {area.sealRef}
                  </text>
                )}
                {area.state === "drafting" && (
                  <text
                    x={b.x + 12}
                    y={b.y + 46}
                    className="font-bp-mono"
                    fontSize={9}
                    fill="var(--color-blueprint-signal)"
                    letterSpacing="0.08em"
                  >
                    DRAFTING…
                  </text>
                )}
                {area.state === "ghost" && (
                  <text
                    x={b.x + 12}
                    y={b.y + 46}
                    className="font-bp-mono"
                    fontSize={8.5}
                    fill="var(--color-ink-faint)"
                  >
                    unlocks: {area.unlockNote}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bylda annotation — quotes the real next-recommended move */}
          {nextMove && draftingArea && BLOCKS[draftingArea.id] && (
            <g aria-hidden="true">
              {(() => {
                const b = BLOCKS[draftingArea.id];
                return (
                  <path
                    d={`M180,368 L${b.x + b.w / 2},${b.y + b.h + 6}`}
                    fill="none"
                    stroke="var(--color-blueprint-brass)"
                    strokeWidth={0.75}
                    strokeDasharray="3 3"
                  />
                );
              })()}
              <rect
                x={16}
                y={352}
                width={330}
                height={52}
                fill="var(--color-blueprint-brass-soft)"
                stroke="var(--color-blueprint-brass)"
                strokeWidth={0.75}
              />
              <text
                x={28}
                y={370}
                className="font-bp-mono"
                fontSize={8.5}
                fill="var(--color-blueprint-brass)"
                letterSpacing="0.1em"
              >
                BYLDA — NEXT ON THE BOARD
              </text>
              <text x={28} y={386} className="font-bp-mono" fontSize={9.5} fill="var(--color-ink)">
                {nextMove.reason.length > 62 ? `${nextMove.reason.slice(0, 62)}…` : nextMove.reason}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend — stroke samples match the three states exactly */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-panel px-4 py-2">
        {(
          [
            ["sealed", "SEALED"],
            ["drafting", "DRAFTING"],
            ["ghost", "NOT BUILT"],
          ] as const
        ).map(([state, label]) => (
          <span key={state} className="inline-flex items-center gap-2">
            <svg width="26" height="10" aria-hidden="true">
              <rect
                x="1"
                y="1"
                width="24"
                height="8"
                fill={STROKE[state].fill}
                stroke={STROKE[state].stroke}
                strokeWidth={1.5}
                strokeDasharray={STROKE[state].dash}
              />
            </svg>
            <span className="font-bp-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim">
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
