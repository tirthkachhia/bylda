import { mocksForced } from "@/lib/data";

// GAP: the data layer has no "people matched from your call source" list for A9
// (per-person call counts, suggested role/team, invite email) — LANE_REQUESTS.md #19.
// These Figma fixtures (Acme Revenue) render ONLY with VITE_BYLDA_MOCKS=true; live mode
// shows the add-by-email form alone. Never show them against a real workspace.

export type InviteCandidate = {
  id: string;
  name: string;
  email: string;
  calls: number;
  role: "rep" | "manager" | "owner";
  team: string | null;
  /** Pre-toggled on. */
  suggested: boolean;
};

const CANDIDATES: InviteCandidate[] = [
  ["u_jordan", "Jordan Reyes", 58, "rep", "Mid-Market AE", true],
  ["u_alex", "Alex Morgan", 44, "rep", "Mid-Market AE", true],
  ["u_mia", "Mia Kowalski", 51, "rep", "Mid-Market AE", true],
  ["u_sarah", "Sarah Lin", 62, "rep", "Mid-Market AE", true],
  ["u_theo", "Theo Grant", 55, "rep", "Mid-Market AE", true],
  ["u_priya", "Priya Nair", 47, "rep", "Mid-Market AE", true],
  ["u_kiran", "Kiran Patel", 0, "owner", null, true],
  ["u_rob", "Rob Baird", 12, "manager", "Enterprise", false],
].map(([id, name, calls, role, team, suggested]) => ({
  id: id as string,
  name: name as string,
  email: `${(name as string).split(" ")[0].toLowerCase()}@acme-revenue.test`,
  calls: calls as number,
  role: role as InviteCandidate["role"],
  team: team as string | null,
  suggested: suggested as boolean,
}));

/** Matched people + the source they were matched from, or null outside forced mocks. */
export function inviteCandidates(): {
  source: string;
  people: InviteCandidate[];
  /** Pre-typed add-by-email value from the frame. */
  emails: string;
  /** People matched to calls, counting you — you're already in, so you aren't listed. */
  matchedCount: number;
} | null {
  return mocksForced()
    ? {
        source: "Zoom",
        people: CANDIDATES,
        emails: "nina@acmerevenue.com, luis@acmerevenue.com",
        matchedCount: CANDIDATES.length + 1,
      }
    : null;
}

/** A6 answers the frame shows pre-filled — industry/motion aren't in the data layer (GAP above). */
export function workspaceDemoDefaults(): { industry: string; motions: string[] } | null {
  return mocksForced()
    ? {
        industry: "B2B SaaS · logistics software",
        motions: ["Outbound", "Mid-market (30–60 day cycle)"],
      }
    : null;
}

// GAP: Figma A7 (15:2) shows the MEDDIC starter set — 7 behaviors, one off. The methodology
// fixture carries 4. Mocks-only, like the rest of this file (LANE_REQUESTS.md #19).
export type TeachDemoBehavior = { key: string; name: string; definition: string; enabled: boolean };

const MEDDIC_STARTER: TeachDemoBehavior[] = [
  ["discovery_depth", "Discovery depth", "follow-up questions per topic", true],
  ["objection_handling", "Objection handling", "diagnose before responding", true],
  ["interruptions", "Interruptions", "overlap while prospect speaks", true],
  ["talk_listen", "Talk / listen balance", "by call stage", true],
  ["economic_buyer", "Economic buyer identified", "MEDDIC · E", true],
  ["next_step_booked", "Next step booked", "date + owner before hanging up", true],
  ["filler_words", "Filler words", "rarely matters for outcomes", false],
].map(([key, name, definition, enabled]) => ({
  key: key as string,
  name: name as string,
  definition: definition as string,
  enabled: enabled as boolean,
}));

/** The A7 behavior list for a template, or null outside forced mocks (use the methodology). */
export function teachDemoBehaviors(template: string): TeachDemoBehavior[] | null {
  return mocksForced() && template === "meddic" ? MEDDIC_STARTER : null;
}

// GAP: per-stage pipeline status and the running "already visible" counts (C-16). Figma A10
// (16:21) shows the CRM match blocked on HubSpot approval, so patterns wait. Mocks-only.
export type AnalysisDemo = {
  importDetail: string;
  crm: { detail: string; status: "blocked" };
  patterns: { status: "waiting" };
  alreadyVisible: string;
};

export function analysisDemo(): AnalysisDemo | null {
  return mocksForced()
    ? {
        importDetail: "486 recordings from Zoom + Gong",
        crm: { detail: "Waiting for HubSpot approval", status: "blocked" },
        patterns: { status: "waiting" },
        alreadyVisible:
          "312 calls transcribed · 1,904 objections detected so far · 9 reps matched to calendar accounts",
      }
    : null;
}

// GAP: Insight carries no metric trio (with vs without, outcome rate, count) — C-04,
// LANE_REQUESTS.md #19. Figma A11 (16:244) copy, mocks-only. Confidence + sample size stay.
export type FirstInsightDemo = {
  headline: string;
  metrics: { label: string; value: string; note: string }[];
  evidence: { timestamp: string; speaker: string; quote: string; callId: string };
  examples: number;
  caveat: string;
  sampleSize: number;
  primary: { label: string; behaviorKey: string };
  briefAt: string;
};

export function firstInsightDemo(): FirstInsightDemo | null {
  return mocksForced()
    ? {
        headline:
          "Your reps who win more pause after price objections. The rest answer immediately.",
        metrics: [
          {
            label: "Pause before responding",
            value: "1.9s vs 0.5s",
            note: "top 3 reps vs other 6",
          },
          { label: "Next step booked", value: "74% vs 43%", note: "when they paused vs didn’t" },
          { label: "Price objections", value: "312", note: "across 486 calls" },
        ],
        evidence: {
          timestamp: "12:30",
          speaker: "Theo · Brightline",
          // EvidenceBlock adds the outer quote marks.
          quote:
            "It’s a lot more than we planned for this quarter…” → 2.1s pause → “What were you planning for?",
          callId: "call_brightline",
        },
        examples: 3,
        caveat:
          "Association across 312 objections, not a proven cause. Confidence rises as more deals close.",
        sampleSize: 312,
        primary: { label: "See who this affects", behaviorKey: "pause_after_objection" },
        briefAt: "7:30 AM",
      }
    : null;
}
