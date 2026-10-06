/**
 * I6 layout — what Bylda stores and how it links. Figma 28:857 draws one worked example; the
 * data layer has no graph object to draw one from (LANE_REQUESTS L1-3), so every node shows what
 * it holds. Only the behavior → outcome link carries live data (`strongestAssociation`).
 * Coordinates are canvas pixels, not data.
 */
export type NodeKind =
  | "rep"
  | "prospect"
  | "call"
  | "context"
  | "objection"
  | "stage"
  | "behavior"
  | "sequence"
  | "outcome"
  | "coaching"
  | "change";

export const NODE_W = 150;
export const NODE_H = 58;
/** Five columns 210 apart, plus room for the loop on the right. Fits main at 1440. */
export const CANVAS_W = 1035;
export const CANVAS_H = 560;

export const NODES: { kind: NodeKind; label: string; holds: string; x: number; y: number }[] = [
  { kind: "rep", label: "REP", holds: "Who was on the call", x: 0, y: 40 },
  { kind: "prospect", label: "PROSPECT", holds: "Who they sold to", x: 0, y: 260 },
  { kind: "call", label: "CALL", holds: "One conversation", x: 210, y: 150 },
  { kind: "context", label: "CONTEXT", holds: "Stage, deal size, call number", x: 210, y: 400 },
  {
    kind: "objection",
    label: "OBJECTION",
    holds: "What the prospect pushed back on",
    x: 420,
    y: 0,
  },
  {
    kind: "stage",
    label: "METHODOLOGY STAGE",
    holds: "Where in your method it happened",
    x: 420,
    y: 260,
  },
  { kind: "behavior", label: "BEHAVIOR", holds: "What the rep did", x: 630, y: 40 },
  {
    kind: "sequence",
    label: "BEHAVIOR SEQUENCE",
    holds: "Behaviors in the order they happened",
    x: 630,
    y: 240,
  },
  { kind: "outcome", label: "OUTCOME", holds: "What happened next", x: 840, y: 40 },
  {
    kind: "coaching",
    label: "COACHING ACTION",
    holds: "The focus a manager assigned",
    x: 840,
    y: 260,
  },
  {
    kind: "change",
    label: "CHANGE OVER TIME",
    holds: "Did the behavior move after coaching",
    x: 840,
    y: 480,
  },
];

/** `h` = right edge → left edge, `v` = bottom edge → top edge, `loop` = out the right and back in. */
export type EdgeRoute = "h" | "v" | "loop";

export const EDGES: {
  from: NodeKind;
  to: NodeKind;
  label?: string;
  route: EdgeRoute;
  /** The one edge that is a statistical association, not a recorded fact: drawn dashed. */
  association?: boolean;
  /**
   * Where the label sits when the midpoint would land on a box: `above` both boxes, or turned
   * `vertical` beside the loop. Default: on the midpoint.
   */
  labelPlace?: "above" | "vertical";
}[] = [
  { from: "rep", to: "call", label: "in", route: "h" },
  { from: "prospect", to: "call", label: "in", route: "h" },
  { from: "call", to: "objection", label: "contains", route: "h" },
  { from: "call", to: "stage", label: "at", route: "h" },
  { from: "call", to: "context", label: "within", route: "v" },
  { from: "objection", to: "behavior", label: "response", route: "h", labelPlace: "above" },
  { from: "stage", to: "sequence", route: "h" },
  { from: "behavior", to: "sequence", label: "part of", route: "v" },
  {
    from: "behavior",
    to: "outcome",
    label: "associated",
    route: "h",
    association: true,
    labelPlace: "above",
  },
  { from: "outcome", to: "coaching", label: "triggers", route: "v" },
  { from: "coaching", to: "change", label: "measured by", route: "v" },
  { from: "change", to: "outcome", label: "next outcomes", route: "loop", labelPlace: "vertical" },
];

type Pt = { x: number; y: number };
const node = (k: NodeKind) => NODES.find((n) => n.kind === k)!;

/** SVG path + label anchor for an edge. */
export function edgeGeometry(
  from: NodeKind,
  to: NodeKind,
  route: EdgeRoute,
): { d: string; mid: Pt } {
  const a = node(from);
  const b = node(to);
  let p0: Pt;
  let p1: Pt;
  let c0: Pt;
  let c1: Pt;
  if (route === "v") {
    p0 = { x: a.x + NODE_W / 2, y: a.y + NODE_H };
    p1 = { x: b.x + NODE_W / 2, y: b.y };
    const k = Math.abs(p1.y - p0.y) / 2;
    c0 = { x: p0.x, y: p0.y + k };
    c1 = { x: p1.x, y: p1.y - k };
  } else if (route === "loop") {
    p0 = { x: a.x + NODE_W, y: a.y + NODE_H / 2 };
    p1 = { x: b.x + NODE_W, y: b.y + NODE_H / 2 };
    c0 = { x: p0.x + 45, y: p0.y };
    c1 = { x: p1.x + 45, y: p1.y };
  } else {
    p0 = { x: a.x + NODE_W, y: a.y + NODE_H / 2 };
    p1 = { x: b.x, y: b.y + NODE_H / 2 };
    const k = Math.abs(p1.x - p0.x) / 2;
    c0 = { x: p0.x + k, y: p0.y };
    c1 = { x: p1.x - k, y: p1.y };
  }
  const d = `M${p0.x} ${p0.y} C${c0.x} ${c0.y} ${c1.x} ${c1.y} ${p1.x} ${p1.y}`;
  // Cubic midpoint (t = 0.5).
  const mid = {
    x: (p0.x + 3 * c0.x + 3 * c1.x + p1.x) / 8,
    y: (p0.y + 3 * c0.y + 3 * c1.y + p1.y) / 8,
  };
  return { d, mid };
}

/** Label anchor for an edge (centre point), per its `labelPlace`. */
export function labelAnchor(e: (typeof EDGES)[number]): Pt & { vertical: boolean } {
  const { mid } = edgeGeometry(e.from, e.to, e.route);
  if (e.labelPlace === "above") {
    return { x: mid.x, y: Math.min(node(e.from).y, node(e.to).y) - 10, vertical: false };
  }
  return { ...mid, vertical: e.labelPlace === "vertical" };
}
