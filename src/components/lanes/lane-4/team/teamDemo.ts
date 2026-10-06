import { mocksForced, type Direction, type Sparkline } from "@/lib/data";

// GAP: T1–T7 show fields the team view models don't carry (LANE_REQUESTS.md L4-1):
//   per rep  — attention status, 8-week trajectory (composite vs own baseline), the one-line
//              "recent change", tenure;
//   per team — trajectory / held-control KPIs, held-control distribution, "since" date,
//              delivery schedule (manager brief, rep brief, team room).
// These Figma fixtures (Acme Revenue · Mid-Market AE) render ONLY with VITE_BYLDA_MOCKS=true.
// Live mode shows "—" in those cells or hides the block. Never shown against a real workspace.
// Keyed by the frozen fixture ids (src/lib/data/mocks/people.ts). Figma's "Luis Ortega" is
// the fixture's u_leo.

export type Attention =
  | "coach_now"
  | "watch"
  | "coach_soon"
  | "improving"
  | "strong"
  | "steady"
  | "new";

export type RepDemo = {
  attention: Attention;
  /** Composite of the methodology's important behaviors vs the rep's own baseline. */
  trajectory: { direction: Direction; sparkline: Sparkline } | null;
  recentChange: string;
  tenure: string;
};

/** One fixed y-range for every rep, so a steady rep looks steady (CLAUDE.md §4). */
const traj = (direction: Direction, points: number[]) => ({
  direction,
  sparkline: { points, yMin: -2, yMax: 2 },
});

const REPS: Record<string, RepDemo> = {
  u_jordan: {
    attention: "coach_now",
    trajectory: traj("regressing", [0.9, 1, 0.9, 0.6, 0.4, 0.2, 0, -0.2]),
    recentChange: "Interruptions +0.8 / objection",
    tenure: "14 mo",
  },
  u_sarah: {
    attention: "watch",
    trajectory: traj("regressing", [0.8, 0.9, 0.9, 0.5, 0.5, 0.2, 0.1, 0.1]),
    recentChange: "Interruptions +18% vs baseline",
    tenure: "2 yr",
  },
  u_alex: {
    attention: "improving",
    trajectory: traj("improving", [-0.4, -0.35, -0.2, -0.1, 0.1, 0.25, 0.35, 0.45]),
    recentChange: "Objection talk share 64% → 49%",
    tenure: "9 mo",
  },
  u_mia: {
    attention: "coach_soon",
    trajectory: traj("steady", [0.5, 0.3, 0.6, 0.1, 0.4, -0.1, 0.2, 0.1]),
    recentChange: "1.1 follow-ups / topic (team 2.4)",
    tenure: "6 mo",
  },
  u_theo: {
    attention: "strong",
    trajectory: traj("improving", [-0.3, -0.15, 0, 0, 0.15, 0.3, 0.3, 0.45]),
    recentChange: "Best objection handling on team",
    tenure: "3 yr",
  },
  u_priya: {
    attention: "improving",
    trajectory: traj("improving", [-0.4, -0.3, -0.2, -0.05, 0.1, 0.2, 0.3, 0.4]),
    recentChange: "Next step booked 58% → 81%",
    tenure: "1 yr",
  },
  u_marcus: {
    attention: "steady",
    trajectory: traj("steady", [0, 0.4, 0, 0, 0.4, 0, 0, 0.4]),
    recentChange: "No meaningful change",
    tenure: "2 yr",
  },
  u_nina: {
    attention: "improving",
    trajectory: traj("improving", [-0.35, -0.3, -0.15, -0.1, 0.05, 0.1, 0.2, 0.3]),
    recentChange: "Talk share in demos 72% → 57%",
    tenure: "1 yr",
  },
  u_leo: {
    attention: "new",
    trajectory: traj("steady", [-0.3, -0.1, 0.1, 0.3, 0.3, 0.3, 0.3, 0.3]),
    recentChange: "Not enough calls yet",
    tenure: "3 wk",
  },
};

export type TeamDemo = {
  since: string;
  kpis: {
    trajectory: { value: string; note: string; direction: Direction };
    heldControl: { value: string; note: string; direction: Direction };
  };
  /** "DISTRIBUTION · HELD CONTROL IN OBJECTIONS" buckets. */
  distribution: { label: string; repIds: string[] }[];
  delivery: { managerBrief: string; repBrief: string; room: string; teamRoom: string };
};

const TEAMS: Record<string, TeamDemo> = {
  team_mm: {
    since: "Jul 2026",
    kpis: {
      trajectory: { value: "+0.7", note: "since Aug 1", direction: "improving" },
      heldControl: { value: "54%", note: "↓ 7 pts", direction: "regressing" },
    },
    distribution: [
      { label: "0–25%", repIds: ["u_jordan"] },
      { label: "26–50%", repIds: ["u_sarah", "u_mia"] },
      { label: "51–75%", repIds: ["u_alex", "u_marcus", "u_nina", "u_leo"] },
      { label: "76–100%", repIds: ["u_theo", "u_priya"] },
    ],
    delivery: {
      managerBrief: "7:30 AM · in-app + email",
      repBrief: "8:00 AM · email",
      room: "#daily-brief",
      teamRoom: "#mid-market-team",
    },
  },
};

/** Figma's roster order for the fixture team (T1, T3). Mocks only; live keeps the API's order. */
const ROSTER = [
  "u_jordan",
  "u_sarah",
  "u_alex",
  "u_mia",
  "u_theo",
  "u_priya",
  "u_marcus",
  "u_nina",
  "u_leo",
];
export const rosterIndex = (repId: string): number | null => {
  if (!mocksForced()) return null;
  const i = ROSTER.indexOf(repId);
  return i === -1 ? null : i;
};

/** Mocks only. `null` against a real workspace. */
export const repDemo = (repId: string): RepDemo | null =>
  mocksForced() ? (REPS[repId] ?? null) : null;
export const teamDemo = (teamId: string): TeamDemo | null =>
  mocksForced() ? (TEAMS[teamId] ?? null) : null;
