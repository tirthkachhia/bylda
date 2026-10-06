import type {
  Behavior,
  BehaviorDetail,
  BehaviorExample,
  BehaviorScore,
  CoachingFocus,
  EvidenceRef,
  HomeFeed,
  Insight,
  ObjectionStat,
  OutcomeAssociation,
  Pattern,
  TeamBehaviorRow,
} from "../types";

export const EV_ACME: EvidenceRef = {
  callId: "call_acme",
  timestamp: "18:42",
  tSeconds: 1122,
  speaker: "prospect",
  speakerLabel: "PROSPECT",
  quote: "We already budgeted for another tool this year, and I’d need to see—",
};

export const BEHAVIORS: Behavior[] = [
  {
    key: "pause_after_objection",
    name: "Pause after objection",
    definition: "Seconds of silence after a prospect objection before the rep responds.",
    rule: { event: "objection", measure: "gap_seconds" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: true,
  },
  {
    key: "interrupting_during_objections",
    name: "Interrupting during objections",
    definition: "Rep speaks over the prospect while an objection is being voiced.",
    rule: { event: "interruption", during: "objection" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
  {
    key: "discovery_depth",
    name: "Discovery depth",
    definition: "Follow-up questions per discovery topic.",
    rule: { event: "question", per: "topic" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: true,
  },
  {
    key: "talk_share",
    name: "Talk share",
    definition: "Rep share of talk time.",
    rule: { measure: "talk_ratio" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
  // I1 "12 tracked" / I7 "12 BEHAVIORS TRACKED": the four above plus these eight. The first five
  // of these complete I7's nine drawn rows; demo_before_discovery and talking_over_prospects are
  // named by I3's patterns and call_length by I1's third card.
  {
    key: "early_discounting",
    name: "Early discounting",
    definition: "A discount is offered in the first 60 seconds of a price conversation.",
    rule: { event: "discount", within_seconds: 60 },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
  {
    key: "next_step_booked",
    name: "Next step booked",
    definition: "The call ends with a dated next step.",
    rule: { measure: "next_step_rate" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: true,
  },
  {
    key: "monologue_over_2min",
    name: "Monologue > 2 min",
    definition: "The rep speaks for more than two minutes without a break.",
    rule: { event: "monologue", min_seconds: 120 },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
  {
    key: "economic_buyer_by_s3",
    name: "Economic buyer by S3",
    definition: "The economic buyer is identified by stage 3.",
    rule: { event: "stage", stage: 3, requires: "economic_buyer" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: true,
  },
  {
    key: "recap_before_pricing",
    name: "Recap before pricing",
    definition: "The rep recaps the prospect’s needs before discussing price.",
    rule: { before: "pricing", requires: "recap" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: true,
  },
  {
    key: "demo_before_discovery",
    name: "Demo before discovery",
    definition: "Screen share starts before minute 5 with fewer than 3 questions asked.",
    rule: { event: "control_shift", before_seconds: 300, max_questions: 2 },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
  {
    key: "talking_over_prospects",
    name: "Talking over prospects",
    definition: "Speech overlap above 300ms while the prospect is talking in the demo stage.",
    rule: { event: "interruption", min_overlap_ms: 300, stage: "demo" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
  {
    key: "call_length",
    name: "Call length",
    definition: "Call duration in minutes.",
    rule: { measure: "duration_minutes" },
    methodologyId: "meth_meddic",
    enabled: true,
    higherIsBetter: false,
  },
];

const spark = (points: number[], yMin: number, yMax: number) => ({ points, yMin, yMax });

export const SCORES_JORDAN: BehaviorScore[] = [
  {
    behaviorKey: "pause_after_objection",
    name: "Pause after objection",
    value: 0.4,
    unit: "seconds",
    teamMedian: 1.3,
    direction: "regressing",
    confidence: "high",
    sampleSize: 41,
    sparkline: spark([0.9, 0.7, 0.6, 0.4], 0, 2),
  },
  {
    behaviorKey: "discovery_depth",
    name: "Discovery depth",
    value: 2.9,
    unit: "per_call",
    teamMedian: 2.4,
    direction: "improving",
    confidence: "medium",
    sampleSize: 18,
    sparkline: spark([2.2, 2.5, 2.7, 2.9], 0, 4),
  },
];

export const INSIGHTS: Insight[] = [
  {
    id: "ins_jordan_control",
    kind: "regression",
    headline: "Jordan lost control during 4 of 6 price objections this week.",
    body: "He responds within half a second, before the prospect finishes the concern. Top performers on this team pause ~1.8s and ask one clarifying question first.",
    confidence: "high",
    sampleSize: 6,
    sampleLabel: "n = 6 objections · 4 calls",
    callsAnalyzed: 41,
    affectedRepIds: ["u_jordan"],
    evidence: [EV_ACME],
    action: {
      type: "assign_coaching",
      label: "Assign coaching",
      repId: "u_jordan",
      behaviorKey: "pause_after_objection",
    },
    causalTested: false,
    tone: "regress",
    tag: "↓ Regressing",
    createdAt: "2026-09-30T08:04:00Z",
  },
  {
    id: "ins_discovery_won",
    kind: "pattern",
    headline: "Won deals contain 2.3× more second-level discovery questions.",
    body: "Associated with closed-won outcomes across the Mid-Market AE team this quarter.",
    confidence: "medium",
    // §13.13: a team pattern needs ≥ 50 calls — was n = 41 in Figma.
    sampleSize: 58,
    sampleLabel: "n = 58 calls",
    callsAnalyzed: 58,
    affectedRepIds: [],
    evidence: [],
    action: { type: "open_behavior", label: "View behavior", behaviorKey: "discovery_depth" },
    causalTested: false,
    tone: "info",
    tag: "Pattern",
    createdAt: "2026-09-29T09:00:00Z",
  },
  {
    id: "ins_alex_improving",
    kind: "improvement",
    headline: "Alex is pausing after objections — 3 of the last 4.",
    body: null,
    confidence: "low",
    sampleSize: 4,
    sampleLabel: "n = 4 objections · 14 calls",
    callsAnalyzed: 14,
    affectedRepIds: ["u_alex"],
    evidence: [],
    action: null,
    causalTested: false,
    tone: "improve",
    tag: "↑ Improving",
    createdAt: "2026-09-29T17:00:00Z",
  },
  {
    // Below REP_INSIGHT_MIN_CALLS on purpose — gated to the Y3 insufficient state.
    id: "ins_nina_early",
    kind: "improvement",
    headline: "Nina is asking more second-level discovery questions.",
    body: null,
    confidence: "low",
    sampleSize: 3,
    sampleLabel: "n = 3 calls",
    callsAnalyzed: 6,
    affectedRepIds: ["u_nina"],
    evidence: [],
    action: null,
    causalTested: false,
    tone: "improve",
    tag: "↑ Improving",
    createdAt: "2026-09-29T16:00:00Z",
  },
  // I1 "Important today · 3" — three team-level cards. `callsAnalyzed` is the team's analyzed
  // calls (486, the I1 header), as the Insight type documents for a team pattern; Figma's own
  // n ("19 won · 23 lost · 142 discovery calls", "20 deals") stays in sampleSize / sampleLabel.
  // `tag` carries the eyebrow category ("IMPORTANT TODAY · OUTCOME PATTERN"); Insight has no
  // category field. Appended after the originals so INSIGHTS[0..3] and the Home feed don't move.
  {
    id: "ins_discovery_outcome",
    kind: "pattern",
    headline:
      "Won deals contain more second-level discovery questions — 3.4 per call vs 1.6 in losses.",
    body: "Holds across 5 of 6 reps. Strongest in deals over $30k.",
    confidence: "high",
    sampleSize: 142,
    sampleLabel: "n = 19 won · 23 lost · 142 discovery calls",
    callsAnalyzed: 486,
    affectedRepIds: [],
    evidence: [],
    // Figma also has "Make it a team focus": InsightAction is one action, and assign_coaching
    // needs a repId. GAP: second action + team-level coaching focus.
    action: {
      type: "review_calls",
      label: "See 6 examples",
      callIds: [
        "call_acme",
        "call_brightline",
        "call_kestrel",
        "call_vela",
        "call_ferro",
        "call_lumen",
      ],
    },
    causalTested: false,
    tone: "info",
    tag: "Outcome pattern",
    createdAt: "2026-09-30T08:00:00Z",
  },
  {
    id: "ins_price_discount_losses",
    kind: "pattern",
    headline: "Losses with price objections often include a discount offered in the first 60s.",
    body: "7 of 9 such losses. Wins with price objections: 2 of 11.",
    confidence: "medium",
    sampleSize: 20,
    sampleLabel: "n = 20 deals",
    callsAnalyzed: 486,
    affectedRepIds: [],
    evidence: [],
    action: null,
    causalTested: false,
    tone: "regress",
    tag: "Objection pattern",
    createdAt: "2026-09-30T07:45:00Z",
  },
  {
    id: "ins_call_length",
    kind: "pattern",
    headline: "Calls longer than 42 minutes aren’t producing better outcomes for this team.",
    body: "Next-step rate 68% (<42m) vs 61% (>42m).",
    confidence: "medium",
    sampleSize: 486,
    sampleLabel: "n = 486 calls",
    callsAnalyzed: 486,
    affectedRepIds: [],
    evidence: [],
    action: null,
    causalTested: false,
    tone: "neutral",
    tag: "Call length",
    createdAt: "2026-09-30T07:30:00Z",
  },
  // I3 context panel — "SELECTED · DEMO BEFORE DISCOVERY". About Mia alone, so a rep could see
  // it; but kind "pattern" is always team-gated (insightScope), so it clears on the team's 486.
  // Figma's own sample (7 + 38 first calls = 45) is under the 50-call floor. The panel's
  // Frequency / Associated / Trend rows compare her with the team, so they stay out of this
  // rep-visible insight (CLAUDE.md §4).
  // GAP: nothing links this insight to pat_demo_before_discovery except behaviorKey + rep.
  {
    id: "ins_mia_demo_first",
    kind: "pattern",
    headline:
      "Mia started screen-share before minute 5 on 5 of her last 7 first calls, after fewer than 3 questions.",
    body: null,
    confidence: "medium",
    sampleSize: 7,
    sampleLabel: "n = 7 first calls",
    callsAnalyzed: 486,
    affectedRepIds: ["u_mia"],
    // Figma anchors this on Northwind; in the shared fixtures call_northwind is Nina's 40-second
    // partial call, so the clip points at Mia's own call_vela instead.
    evidence: [
      {
        callId: "call_vela",
        timestamp: "04:10",
        tSeconds: 250,
        speaker: "rep",
        speakerLabel: "MIA · VELA",
        quote: "Let me just show you — it’s easier than explaining.",
      },
    ],
    action: {
      type: "assign_coaching",
      label: "Create coaching focus for Mia",
      repId: "u_mia",
      behaviorKey: "demo_before_discovery",
    },
    causalTested: false,
    tone: "attention",
    tag: "Emerging",
    createdAt: "2026-09-30T07:15:00Z",
  },
];

/**
 * O3 — #objection-watch · Insights. Figma's samples (9 · 1 · 4 · 3 calls) are below the
 * §13.13 thresholds; these fixtures meet them (team ≥ 50, rep ≥ 10).
 */
export const ROOM_INSIGHTS: Record<string, Insight[]> = {
  room_objections: [
    {
      id: "ins_room_defend_price",
      kind: "pattern",
      headline: "Reps defend price before diagnosing the concern.",
      body: "Observed in 31% more price objections this week.",
      confidence: "high",
      sampleSize: 62,
      sampleLabel: "62 calls · 9 reps",
      callsAnalyzed: 62,
      affectedRepIds: [],
      evidence: [EV_ACME],
      action: {
        type: "open_behavior",
        label: "View behavior",
        behaviorKey: "pause_after_objection",
      },
      causalTested: false,
      tone: "info",
      tag: "Pattern · Confirmed",
      createdAt: "2026-09-30T08:00:00Z",
    },
    {
      id: "ins_room_mia_pause",
      kind: "improvement",
      headline: "Mia paused after “budget’s tight” and asked what it was compared to.",
      body: "First time this month — 3 of her last 5 price objections.",
      confidence: "medium",
      sampleSize: 5,
      sampleLabel: "n = 5 objections · 12 calls",
      callsAnalyzed: 12,
      affectedRepIds: ["u_mia"],
      evidence: [],
      action: {
        type: "open_behavior",
        label: "View behavior",
        behaviorKey: "pause_after_objection",
      },
      causalTested: false,
      tone: "improve",
      tag: "Improvement",
      createdAt: "2026-09-30T07:40:00Z",
    },
    {
      id: "ins_room_sarah_interrupt",
      kind: "regression",
      headline: "Interruptions during objections +18% vs her baseline.",
      body: null,
      confidence: "medium",
      sampleSize: 11,
      sampleLabel: "n = 11 calls since Fri",
      callsAnalyzed: 11,
      affectedRepIds: ["u_sarah"],
      evidence: [],
      action: {
        type: "assign_coaching",
        label: "Assign coaching",
        repId: "u_sarah",
        behaviorKey: "interrupting_during_objections",
      },
      causalTested: false,
      tone: "regress",
      tag: "Regression · Sarah Lin",
      createdAt: "2026-09-30T07:20:00Z",
    },
    {
      id: "ins_room_board_froze",
      kind: "pattern",
      headline: "“Board froze new tools” — a new objection phrase.",
      body: "Observed in 6 of 54 calls since Monday.",
      confidence: "low",
      sampleSize: 6,
      sampleLabel: "6 of 54 calls",
      callsAnalyzed: 54,
      affectedRepIds: [],
      evidence: [],
      action: null,
      causalTested: false,
      tone: "info",
      tag: "Pattern · Emerging",
      createdAt: "2026-09-30T07:00:00Z",
    },
  ],
};

export const HOME_FEED: HomeFeed = {
  items: [
    { id: "f1", tab: "for_you", insight: INSIGHTS[0] },
    { id: "f2", tab: "team_updates", insight: INSIGHTS[1] },
    { id: "f3", tab: "coaching", insight: INSIGHTS[2] },
  ],
  attention: [
    {
      id: "at1",
      title: "Aircall stopped syncing on Sep 27",
      severity: "regress",
      href: "/app/connections",
    },
  ],
  coachQueue: [
    {
      repId: "u_jordan",
      repName: "Jordan Reyes",
      behaviorName: "Pause after objection",
      reason: "4 of 6 price objections lost control",
    },
  ],
};

/** I2 · Figma 11:2 sample content — Interrupting during objections (Acme Revenue fixture). */
const INTERRUPTION_AVOID: BehaviorExample = {
  repId: "u_jordan",
  repName: "Jordan Reyes",
  account: "Acme Logistics",
  callId: "call_acme",
  timestamp: "18:44",
  tSeconds: 1124,
  summary:
    "CFO was mid-sentence on rollout risk; Jordan cut in with a 12% discount. The objection came back at 27:05.",
  clipSeconds: 40,
  moment: {
    callId: "call_acme",
    timestamp: "18:42",
    tSeconds: 1122,
    speaker: "prospect",
    speakerLabel: "ACME · CFO",
    quote: "Honestly the number isn’t the problem, it’s whether my team will actually—",
  },
};

const INTERRUPTION_COPY: BehaviorExample = {
  repId: "u_theo",
  repName: "Theo Brandt",
  account: "Brightline Freight",
  callId: "call_brightline",
  timestamp: "12:30",
  tSeconds: 750,
  summary:
    "Theo waited 2.1s after the objection, then asked what was driving it. The prospect named the real blocker (IT review).",
  clipSeconds: 40,
  moment: {
    callId: "call_brightline",
    timestamp: "12:30",
    tSeconds: 750,
    speaker: "prospect",
    speakerLabel: "BRIGHTLINE · VP OPS",
    quote: "It’s a lot more than we planned for this quarter…",
  },
};

export const BEHAVIOR_DETAIL_INTERRUPTING: BehaviorDetail = {
  behavior: BEHAVIORS[1],
  teamValue: 0.9,
  unit: "per_call",
  direction: "regressing",
  confidence: "medium",
  sampleSize: 142,
  // 0.76 → 0.9 is the +18% I2 draws as "TEAM TREND · 30D" (the lane derives it from first → last).
  sparkline: spark([0.76, 0.74, 0.78, 0.8, 0.83, 0.86, 0.88, 0.9], 0, 2),
  byRep: [
    { repId: "u_jordan", repName: "Jordan Reyes", value: 1.5, n: 12, vsBaseline: 0.8 },
    { repId: "u_sarah", repName: "Sarah Lin", value: 1.2, n: 9, vsBaseline: 0.5 },
    { repId: "u_alex", repName: "Alex Morgan", value: 0.7, n: 11, vsBaseline: -0.4 },
    { repId: "u_theo", repName: "Theo Brandt", value: 0.2, n: 6, vsBaseline: 0 },
  ],
  evidence: [INTERRUPTION_AVOID.moment],
  callsWithBehavior: { withBehavior: 38, total: 142 },
  teamSize: 9,
  repSparklines: {
    u_jordan: spark([0.7, 0.8, 0.9, 1.0, 1.1, 1.3, 1.4, 1.5], 0, 2),
    u_sarah: spark([0.7, 0.7, 0.8, 0.9, 1.0, 1.0, 1.1, 1.2], 0, 2),
    u_alex: spark([1.1, 1.1, 1.0, 0.9, 0.8, 0.8, 0.7, 0.7], 0, 2),
    u_theo: spark([0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.2, 0.2], 0, 2),
  },
  projected: [0.93, 0.96],
  examples: { avoid: INTERRUPTION_AVOID, copy: INTERRUPTION_COPY },
  recommendedChange:
    "Coach one move: after any objection, let the prospect finish, pause, and ask one clarifying question before responding.",
  affectedCalls: [
    {
      callId: "call_acme",
      account: "Acme Logistics",
      repName: "Jordan Reyes",
      timestamp: "18:44",
      tSeconds: 1124,
      count: 3,
    },
    {
      callId: "call_kestrel",
      account: "Kestrel Labs",
      repName: "Jordan Reyes",
      timestamp: "22:10",
      tSeconds: 1330,
      count: 2,
    },
    {
      callId: "call_ferro",
      account: "Ferro Metals",
      repName: "Sarah Lin",
      timestamp: "09:31",
      tSeconds: 571,
      count: 2,
    },
    {
      callId: "call_northwind",
      account: "Northwind Health",
      repName: "Sarah Lin",
      timestamp: "15:02",
      tSeconds: 902,
      count: 1,
    },
    {
      callId: "call_vela",
      account: "Vela Systems",
      repName: "Jordan Reyes",
      timestamp: "31:18",
      tSeconds: 1878,
      count: 2,
    },
  ],
};

/**
 * One detail per tracked behavior (I2), each with its own `byRep`. Only the headline fields and
 * `byRep` are modelled; everything I2 draws beyond that is empty or null, never borrowed from
 * another behavior. A behavior with no entry here has no detail (loadBehaviorDetail → null).
 *
 * `byRep` is listed needs-work first, best last, as I2 (11:2) draws its sample. Screens don't rely
 * on that order: I7's BEST / NEEDS WORK (51:1420) are the extremes of `value`, read through
 * `behavior.higherIsBetter`. The nine I7 draws resolve to its names; ranks are as drawn, values
 * invented. I7 draws the pause distribution's ninth rep as "Luis" — the fixture's ninth Mid-Market
 * rep is Leo Park, so Leo takes that slot.
 * GAP: I7 draws BEST for Recap before pricing as "Dana's team", a team, not a rep; `byRep` holds
 * reps only, so Priya is best there.
 * GAP: Figma shows "2.6 / topic", "0.9 / obj", "52 / 48", "61% by stage 3" and a 30-day change in
 * mixed units ("+0.4", "+3 pts", "—"), and a "Watch" tag; BehaviorDetail has a unit enum, a fixed
 * range and a three-value direction, so those labels live on TeamBehaviorRow only.
 */
const summary = (
  key: string,
  o: Pick<
    BehaviorDetail,
    "teamValue" | "unit" | "direction" | "confidence" | "sampleSize" | "sparkline" | "byRep"
  >,
): BehaviorDetail => ({
  behavior: behaviorByKey(key),
  ...o,
  evidence: [],
  callsWithBehavior: null,
  teamSize: 9,
  repSparklines: {},
  projected: [],
  examples: { avoid: null, copy: null },
  recommendedChange: null,
  affectedCalls: [],
});
const behaviorByKey = (key: string): Behavior => {
  const b = BEHAVIORS.find((x) => x.key === key);
  if (!b) throw new Error(`mock behavior missing: ${key}`);
  return b;
};
const rep = (repId: string, repName: string, value: number, n: number) => ({
  repId,
  repName,
  value,
  n,
  vsBaseline: null,
});

export const BEHAVIOR_DETAILS: Record<string, BehaviorDetail> = {
  interrupting_during_objections: BEHAVIOR_DETAIL_INTERRUPTING,
  discovery_depth: summary("discovery_depth", {
    teamValue: 2.6,
    unit: "count",
    direction: "improving",
    confidence: "high",
    sampleSize: 142,
    sparkline: spark([2.2, 2.3, 2.2, 2.4, 2.5, 2.6], 0, 4),
    byRep: [
      rep("u_mia", "Mia Kowalski", 1.8, 7),
      rep("u_alex", "Alex Morgan", 2.7, 11),
      rep("u_jordan", "Jordan Reyes", 2.9, 12),
      rep("u_priya", "Priya Nair", 3.1, 8),
      rep("u_theo", "Theo Brandt", 3.4, 9),
    ],
  }),
  next_step_booked: summary("next_step_booked", {
    teamValue: 74,
    unit: "percent",
    direction: "steady",
    confidence: "high",
    sampleSize: 486,
    sparkline: spark([71, 70, 72, 72, 73, 74], 0, 100),
    byRep: [
      rep("u_sarah", "Sarah Lin", 61, 49),
      rep("u_jordan", "Jordan Reyes", 70, 66),
      rep("u_alex", "Alex Morgan", 76, 58),
      rep("u_theo", "Theo Brandt", 79, 52),
      rep("u_priya", "Priya Nair", 84, 61),
    ],
  }),
  talk_share: summary("talk_share", {
    teamValue: 0.52,
    unit: "ratio",
    direction: "steady",
    confidence: "high",
    sampleSize: 486,
    sparkline: spark([0.54, 0.54, 0.53, 0.53, 0.52, 0.52], 0, 1),
    byRep: [
      rep("u_jordan", "Jordan Reyes", 0.64, 66),
      rep("u_sarah", "Sarah Lin", 0.55, 49),
      rep("u_alex", "Alex Morgan", 0.5, 58),
      rep("u_priya", "Priya Nair", 0.47, 61),
      rep("u_theo", "Theo Brandt", 0.41, 52),
    ],
  }),
  economic_buyer_by_s3: summary("economic_buyer_by_s3", {
    teamValue: 61,
    unit: "percent",
    direction: "steady",
    confidence: "medium",
    sampleSize: 128,
    sparkline: spark([61, 55, 50, 56, 60, 61], 0, 100),
    byRep: [
      rep("u_sarah", "Sarah Lin", 38, 13),
      rep("u_jordan", "Jordan Reyes", 55, 18),
      rep("u_alex", "Alex Morgan", 62, 16),
      rep("u_priya", "Priya Nair", 70, 14),
      rep("u_theo", "Theo Brandt", 80, 15),
    ],
  }),
  // I7 DISTRIBUTION · PAUSE AFTER OBJECTION: < 0.5s Jordan · Sarah · 0.5–1s Mia · Luis (Leo) ·
  // 1–1.5s Alex · Marcus · Nina · > 1.5s Theo · Priya. All nine reps; the median is the 1.1s team
  // value. Jordan's 0.4s over 41 is his own R2 score (SCORES_JORDAN). The fixed y-range is 0–2s
  // here and in SCORES_JORDAN: I7 bands reps into quarters of it, which are Figma's 0.5s edges.
  pause_after_objection: summary("pause_after_objection", {
    teamValue: 1.1,
    unit: "seconds",
    direction: "regressing",
    confidence: "high",
    sampleSize: 486,
    sparkline: spark([1.3, 1.3, 1.2, 1.2, 1.1, 1.1], 0, 2),
    byRep: [
      rep("u_jordan", "Jordan Reyes", 0.4, 41),
      rep("u_sarah", "Sarah Lin", 0.45, 33),
      rep("u_leo", "Leo Park", 0.6, 11),
      rep("u_mia", "Mia Kowalski", 0.8, 24),
      rep("u_nina", "Nina Okafor", 1.1, 19),
      rep("u_marcus", "Marcus Hale", 1.2, 22),
      rep("u_alex", "Alex Morgan", 1.4, 29),
      rep("u_priya", "Priya Nair", 1.7, 31),
      rep("u_theo", "Theo Brandt", 1.9, 27),
    ],
  }),
  early_discounting: summary("early_discounting", {
    teamValue: 31,
    unit: "percent",
    direction: "regressing",
    confidence: "high",
    sampleSize: 186,
    sparkline: spark([22, 24, 25, 27, 29, 31], 0, 100),
    byRep: [
      rep("u_jordan", "Jordan Reyes", 54, 41),
      rep("u_mia", "Mia Kowalski", 38, 24),
      rep("u_sarah", "Sarah Lin", 33, 33),
      rep("u_alex", "Alex Morgan", 27, 29),
      rep("u_theo", "Theo Brandt", 18, 27),
      rep("u_priya", "Priya Nair", 12, 31),
    ],
  }),
  // Alex is the I3 "Monologues on ROI" rep (fading).
  monologue_over_2min: summary("monologue_over_2min", {
    teamValue: 0.4,
    unit: "per_call",
    direction: "improving",
    confidence: "high",
    sampleSize: 486,
    sparkline: spark([0.7, 0.6, 0.6, 0.5, 0.4, 0.4], 0, 2),
    byRep: [
      rep("u_alex", "Alex Morgan", 0.9, 58),
      rep("u_jordan", "Jordan Reyes", 0.6, 66),
      rep("u_mia", "Mia Kowalski", 0.5, 44),
      rep("u_sarah", "Sarah Lin", 0.4, 49),
      rep("u_theo", "Theo Brandt", 0.3, 52),
      rep("u_nina", "Nina Okafor", 0.1, 47),
    ],
  }),
  recap_before_pricing: summary("recap_before_pricing", {
    teamValue: 38,
    unit: "percent",
    direction: "steady",
    confidence: "medium",
    sampleSize: 142,
    sparkline: spark([34, 35, 36, 36, 37, 38], 0, 100),
    byRep: [
      rep("u_marcus", "Marcus Hale", 18, 14),
      rep("u_sarah", "Sarah Lin", 29, 17),
      rep("u_jordan", "Jordan Reyes", 33, 22),
      rep("u_alex", "Alex Morgan", 40, 19),
      rep("u_theo", "Theo Brandt", 52, 16),
      rep("u_priya", "Priya Nair", 61, 18),
    ],
  }),
  // Not drawn in I7. I3's selected panel: "5 of 7 Mia first calls · 1 of 38 rest of team", so
  // Mia is 5 / 7 and the one other occurrence is Jordan's; the rest of the 38 sit at 0.
  demo_before_discovery: summary("demo_before_discovery", {
    teamValue: 12,
    unit: "percent",
    direction: "regressing",
    confidence: "low",
    sampleSize: 45,
    sparkline: spark([7, 8, 9, 10, 11, 12], 0, 100),
    byRep: [
      rep("u_mia", "Mia Kowalski", 71, 7),
      rep("u_jordan", "Jordan Reyes", 8, 12),
      rep("u_alex", "Alex Morgan", 0, 9),
      rep("u_theo", "Theo Brandt", 0, 8),
      rep("u_priya", "Priya Nair", 0, 9),
    ],
  }),
  // Not drawn in I7. Nina's I3 pattern is resolved, so she sits near the bottom.
  talking_over_prospects: summary("talking_over_prospects", {
    teamValue: 0.2,
    unit: "per_call",
    direction: "improving",
    confidence: "medium",
    sampleSize: 64,
    sparkline: spark([0.3, 0.3, 0.3, 0.2, 0.2, 0.2], 0, 2),
    byRep: [
      rep("u_jordan", "Jordan Reyes", 0.4, 14),
      rep("u_sarah", "Sarah Lin", 0.3, 12),
      rep("u_mia", "Mia Kowalski", 0.2, 11),
      rep("u_nina", "Nina Okafor", 0.1, 13),
      rep("u_theo", "Theo Brandt", 0, 14),
    ],
  }),
  // Not drawn in I7. Minutes; I1's third card: past 42 minutes isn't buying better outcomes.
  call_length: summary("call_length", {
    teamValue: 36,
    unit: "count",
    direction: "steady",
    confidence: "high",
    sampleSize: 486,
    sparkline: spark([34, 34, 35, 35, 36, 36], 0, 60),
    byRep: [
      rep("u_jordan", "Jordan Reyes", 44, 66),
      rep("u_alex", "Alex Morgan", 39, 58),
      rep("u_sarah", "Sarah Lin", 37, 49),
      rep("u_theo", "Theo Brandt", 33, 52),
      rep("u_priya", "Priya Nair", 31, 61),
    ],
  }),
};

/**
 * I1 "Team behaviors · 12 tracked · 5 shown" / I7: one row per tracked behavior, every number read
 * from BEHAVIOR_DETAILS so the table and the detail can't drift. The five I1 draws come first (so a
 * screen takes the first five); the rest follow I7's order, then the three I7 doesn't draw.
 * GAP: the rule that picks Figma's five isn't stated, and I7's own order differs.
 * Labels as Figma draws them ("2.6 / topic", "52 / 48", "−2 pts", "—").
 * Not in Figma, so invented: demo_before_discovery, talking_over_prospects, call_length.
 */
const detailRow = (key: string, valueLabel: string, changeLabel: string): TeamBehaviorRow => {
  const d = BEHAVIOR_DETAILS[key];
  return {
    behaviorKey: key,
    name: d.behavior.name,
    teamValue: d.teamValue,
    unit: d.unit,
    valueLabel,
    changeLabel,
    direction: d.direction,
    sparkline: d.sparkline,
    confidence: d.confidence,
    sampleSize: d.sampleSize,
  };
};

export const TEAM_BEHAVIOR_ROWS: TeamBehaviorRow[] = [
  detailRow("discovery_depth", "2.6 / topic", "+0.4"),
  detailRow("interrupting_during_objections", "0.9 / obj", "+18%"),
  detailRow("next_step_booked", "74%", "+3 pts"),
  detailRow("talk_share", "52 / 48", "−2 pts"),
  detailRow("economic_buyer_by_s3", "61% by stage 3", "—"),
  detailRow("pause_after_objection", "1.1s", "−0.2s"),
  detailRow("early_discounting", "31%", "+9 pts"),
  detailRow("monologue_over_2min", "0.4 / call", "−0.3"),
  detailRow("recap_before_pricing", "38%", "+4 pts"),
  detailRow("demo_before_discovery", "12%", "+5 pts"),
  detailRow("talking_over_prospects", "0.2 / call", "−0.1"),
  detailRow("call_length", "36 min", "+2 min"),
];

/**
 * I3 Emerging Patterns — the six rows Figma draws, in its order. Tab counts come from these six
 * rows (Emerging 2 · Confirmed 2 · Fading 1 · Resolved 1), not from Figma's 11. I1's "Emerging
 * patterns 5" is the five open ones. `sampleSize` is the CALLS column. Rulings over Figma: the two
 * Confirmed rows are raised to n ≥ 30 (the lifecycle legend), and the Resolved row keeps its 0
 * calls but shows no confidence (patternShowsConfidence), so its stored level is the last one
 * measured. Scope is by who it names: one rep → rep, two or more → team, a step → methodology.
 */
export const PATTERNS: Pattern[] = [
  {
    id: "pat_price_early",
    scope: "team",
    headline: "Defending price before diagnosing",
    confidence: "high",
    sampleSize: 34,
    firstSeenAt: "2026-09-08",
    behaviorKey: "pause_after_objection",
    affectedRepIds: ["u_jordan", "u_alex", "u_mia"],
    status: "confirmed",
    rule: "Answers price objection < 1s, then discounts",
  },
  {
    id: "pat_demo_before_discovery",
    scope: "rep",
    headline: "Demo before discovery",
    confidence: "medium",
    sampleSize: 5,
    firstSeenAt: "2026-09-21",
    behaviorKey: "demo_before_discovery",
    affectedRepIds: ["u_mia"],
    status: "emerging",
    rule: "Screen share before 5 min, < 3 questions",
    selected: {
      frequency: "5 of 7 Mia first calls · 1 of 38 rest of team",
      associatedOutcome: "Next step 40% vs team 74%",
      trend: "New this month",
    },
  },
  {
    id: "pat_eb_stage3",
    scope: "methodology",
    headline: "Late economic-buyer contact",
    confidence: "low",
    sampleSize: 7,
    firstSeenAt: "2026-09-24",
    behaviorKey: "economic_buyer_by_s3",
    affectedRepIds: ["u_sarah", "u_nina"],
    status: "emerging",
    rule: "EB not on a call by stage 3",
  },
  {
    id: "pat_pause_after_objection",
    scope: "team",
    headline: "Pausing after objections",
    confidence: "high",
    sampleSize: 38,
    firstSeenAt: "2026-08-02",
    behaviorKey: "pause_after_objection",
    affectedRepIds: ["u_theo", "u_priya"],
    status: "confirmed",
    rule: "≥ 1.5s before responding",
  },
  {
    id: "pat_roi_monologue",
    scope: "rep",
    headline: "Monologues on ROI",
    confidence: "medium",
    sampleSize: 4,
    firstSeenAt: "2026-07-30",
    behaviorKey: "monologue_over_2min",
    affectedRepIds: ["u_alex"],
    status: "fading",
    rule: "> 2 min rep speech on value",
  },
  {
    id: "pat_talking_over_demo",
    scope: "rep",
    headline: "Talking over prospects in demos",
    confidence: "high",
    sampleSize: 0,
    firstSeenAt: "2026-07-12",
    behaviorKey: "talking_over_prospects",
    affectedRepIds: ["u_nina"],
    status: "resolved",
    rule: "Overlap > 300ms in demo stage",
  },
];

/**
 * I9 Outcome patterns (51:1819), scope "outcome": the three cards Figma draws, in its order. The
 * first is the full-width hero (19 won + 23 lost = 42 closed), then CYCLE LENGTH (n = 14) and
 * STALLS (n = 6). Team-wide aggregates, so no rep is named. Kept out of the I3 list (see
 * loadPatterns).
 * I9's BEHAVIOR ↔ OUTCOME table is not modelled here: it is how often a behavior is seen in won vs
 * lost deals (EB by stage 3 79% / 43%, Discount in first 60s 9% / 64%, Recap before pricing
 * 58% / 22%, Talk share > 65% 12% / 19%), while OutcomeAssociation is the outcome rate with vs
 * without the behavior. I5 (28:743) has Recap before pricing × closed-won as "n too small", so
 * adding I9's numbers to OUTCOMES would contradict a merged screen.
 * GAP: won/lost prevalence has no type. The hero's "19 won · 23 lost" label, the eyebrows
 * ("OUTCOME PATTERN · WON vs LOST", "CYCLE LENGTH", "STALLS") and OUTCOMES IN SCOPE (Won 19 ·
 * Lost 23 · Advanced (14d) 41 · Stalled 6 · Open 88) have no field. firstSeenAt is not drawn, so
 * invented. No lifecycle status: I9 draws none.
 */
export const OUTCOME_PATTERNS: Pattern[] = [
  {
    id: "pat_out_discovery_won",
    scope: "outcome",
    headline:
      "Won deals contain more second-level discovery questions — 3.4 per call vs 1.6 in losses.",
    confidence: "high",
    sampleSize: 42,
    firstSeenAt: "2026-08-18",
    behaviorKey: "discovery_depth",
    affectedRepIds: [],
    rule: null,
  },
  {
    id: "pat_out_mutual_plan",
    scope: "outcome",
    headline: "Deals with a mutual plan by call 3 closed 11 days faster.",
    confidence: "low",
    sampleSize: 14,
    firstSeenAt: "2026-09-15",
    // no tracked behavior for a mutual plan
    behaviorKey: null,
    affectedRepIds: [],
    rule: null,
  },
  {
    id: "pat_out_stalls_price",
    scope: "outcome",
    headline: "4 of 6 stalled deals stalled right after an unhandled price objection.",
    confidence: "medium",
    sampleSize: 6,
    firstSeenAt: "2026-09-22",
    behaviorKey: null,
    affectedRepIds: [],
    rule: null,
  },
];

/** I11 rows: WHAT FOLLOWS is `selected.associatedOutcome`; the window is I11's "LAST 30 DAYS". */
const prospectRow = (
  id: string,
  headline: string,
  sampleSize: number,
  confidence: Pattern["confidence"],
  firstSeenAt: string,
  frequency: string,
  associatedOutcome: string | null,
  trend = "Last 30 days",
  behaviorKey: string | null = null,
): Pattern => ({
  id,
  scope: "prospect",
  headline,
  confidence,
  sampleSize,
  firstSeenAt,
  behaviorKey,
  affectedRepIds: [],
  rule: null,
  selected: { frequency, associatedOutcome, trend },
});

/**
 * I11 Prospect patterns (51:2556), scope "prospect": the five WHAT PROSPECTS DO — AND WHAT FOLLOWS
 * rows in Figma's order. `sampleSize` is the CALLS column, `selected.associatedOutcome` the WHAT
 * FOLLOWS cell. Aggregate only — Bylda builds no profile of a prospect — so no rep or prospect is
 * named anywhere.
 * GAP: Figma's hero sentence ("When a CFO joins, the first objection is about rollout risk 3× more
 * often than price — but reps answer it as price.", Medium, 22 calls with a CFO) is the CFO row's
 * finding, and Pattern has one headline. A separate row for it would be a sixth table row, so the
 * CFO row carries the short headline. The "PROSPECT PATTERN · CFOs" eyebrow and BY PERSONA (CFO /
 * Finance, Ops lead, IT, VP Sales) have no field. "Board / budget freeze language" has no outcome
 * yet: Figma's "New — watching" is its trend, and WHAT FOLLOWS is null. firstSeenAt is invented.
 */
export const PROSPECT_PATTERNS: Pattern[] = [
  prospectRow(
    "pat_pro_cfo_on_call",
    "CFO on the call",
    22,
    "medium",
    "2026-09-02",
    "22 calls with a CFO",
    "Rollout-risk objection by min 20 (68%)",
  ),
  prospectRow(
    "pat_pro_already_gong",
    "“We already use Gong”",
    31,
    "medium",
    "2026-08-26",
    "31 calls",
    "Asks for integration detail next (55%)",
  ),
  prospectRow(
    "pat_pro_talk_share",
    "Prospect talk share > 55% in discovery",
    104,
    "high",
    "2026-08-04",
    "104 discovery calls",
    "Next step booked 81% vs 58%",
    "Last 30 days",
    "talk_share",
  ),
  prospectRow(
    "pat_pro_stakeholders",
    "Multiple stakeholders (3+)",
    46,
    "low",
    "2026-08-19",
    "46 calls",
    "Longer cycle, higher close rate",
  ),
  prospectRow(
    "pat_pro_budget_freeze",
    "Board / budget freeze language",
    3,
    "low",
    "2026-09-29",
    "3 calls",
    null,
    "New — watching",
  ),
];

/**
 * I4 Objections — the six rows Figma draws (I1 tab "Objections 6"). Labels, COUNT and HELD as
 * drawn; Unclassified has no HELD rate (—). `callCount` is not in Figma. GAP: BEST HANDLER and
 * WHAT WORKS have no field.
 */
export const OBJECTIONS: ObjectionStat[] = [
  {
    label: "Price / budget",
    count: 312,
    callCount: 186,
    handledWellRate: 0.46,
    trend: "regressing",
    sampleSize: 312,
    confidence: "high",
  },
  {
    label: "Timing / not now",
    count: 201,
    callCount: 148,
    handledWellRate: 0.63,
    trend: "steady",
    sampleSize: 201,
    confidence: "high",
  },
  {
    label: "Already have a tool",
    count: 144,
    callCount: 112,
    handledWellRate: 0.52,
    trend: "steady",
    sampleSize: 144,
    confidence: "high",
  },
  {
    label: "Implementation risk",
    count: 88,
    callCount: 71,
    handledWellRate: 0.38,
    trend: "regressing",
    sampleSize: 88,
    confidence: "medium",
  },
  {
    label: "Need to check with team",
    count: 131,
    callCount: 104,
    handledWellRate: 0.71,
    trend: "improving",
    sampleSize: 131,
    confidence: "high",
  },
  {
    label: "Unclassified",
    count: 47,
    callCount: 39,
    handledWellRate: null,
    trend: "steady",
    sampleSize: 47,
    confidence: "low",
  },
];

export const OUTCOMES: OutcomeAssociation[] = [
  {
    behaviorKey: "discovery_depth",
    behaviorName: "Discovery depth",
    outcome: "won",
    withRate: 0.41,
    withoutRate: 0.18,
    nWith: 22,
    nWithout: 19,
    nClosed: 41,
    confidence: "medium",
    confounders: ["deal size", "segment"],
  },
  {
    behaviorKey: "pause_after_objection",
    behaviorName: "Pause after objection",
    outcome: "advanced",
    withRate: 0.55,
    withoutRate: 0.3,
    nWith: 4,
    nWithout: 3,
    nClosed: 7,
    confidence: "low",
    confounders: [],
  },
  // I1 team-behaviors table, ASSOCIATED WITH column. Each outcome is its own row: "Stage advanced,
  // won" is two. "Weak signal" has no outcome of its own: it is a low-confidence, near-zero gap.
  {
    behaviorKey: "discovery_depth",
    behaviorName: "Discovery depth",
    outcome: "advanced",
    withRate: 0.64,
    withoutRate: 0.38,
    nWith: 214,
    nWithout: 272,
    nClosed: 486,
    confidence: "high",
    confounders: ["deal size", "segment"],
  },
  {
    behaviorKey: "interrupting_during_objections",
    behaviorName: "Interrupting during objections",
    outcome: "next_step_booked",
    withRate: 0.52,
    withoutRate: 0.78,
    nWith: 38,
    nWithout: 104,
    nClosed: 142,
    confidence: "medium",
    confounders: ["deal size"],
  },
  {
    behaviorKey: "next_step_booked",
    behaviorName: "Next step booked",
    outcome: "advanced",
    withRate: 0.7,
    withoutRate: 0.29,
    nWith: 360,
    nWithout: 126,
    nClosed: 486,
    confidence: "high",
    confounders: ["segment"],
  },
  {
    behaviorKey: "talk_share",
    behaviorName: "Talk share",
    outcome: "advanced",
    withRate: 0.47,
    withoutRate: 0.45,
    nWith: 240,
    nWithout: 246,
    nClosed: 486,
    confidence: "low",
    confounders: [],
  },
  {
    behaviorKey: "economic_buyer_by_s3",
    behaviorName: "Economic buyer by S3",
    outcome: "won",
    withRate: 0.44,
    withoutRate: 0.19,
    nWith: 25,
    nWithout: 17,
    nClosed: 42,
    confidence: "medium",
    confounders: ["deal size"],
  },
];

export const COACHING: CoachingFocus[] = [
  {
    id: "cf_jordan_pause",
    repId: "u_jordan",
    repName: "Jordan Reyes",
    behaviorKey: "pause_after_objection",
    behaviorName: "Pause after objection",
    note: "Pause · ask “what’s behind that?” · then answer.",
    evidence: [EV_ACME],
    metric: "seconds before responding to an objection",
    baseline: 0.4,
    target: 1.5,
    judgeAfter: { calls: 5, date: null },
    status: "measuring",
    result: null,
    assignedById: "u_dana",
    assignedAt: "2026-09-29T10:00:00Z",
    acknowledgedAt: "2026-09-29T12:00:00Z",
  },
  {
    id: "cf_alex_pause",
    repId: "u_alex",
    repName: "Alex Morgan",
    behaviorKey: "pause_after_objection",
    behaviorName: "Pause after objection",
    note: "Hold the pause, then one clarifying question.",
    evidence: [],
    metric: "seconds before responding to an objection",
    baseline: 0.6,
    target: 1.5,
    judgeAfter: { calls: 5, date: null },
    status: "held",
    result: {
      value: 1.8,
      baseline: 0.6,
      target: 1.5,
      verdict: "held",
      measuredOn: "2026-09-25T00:00:00Z",
      sampleSize: 5,
    },
    assignedById: "u_dana",
    assignedAt: "2026-09-10T10:00:00Z",
    acknowledgedAt: "2026-09-10T11:00:00Z",
  },
  {
    id: "cf_mia_eb",
    repId: "u_mia",
    repName: "Mia Kowalski",
    behaviorKey: "discovery_depth",
    behaviorName: "Discovery depth",
    note: "Cover Metrics before demo.",
    evidence: [],
    metric: "follow-ups per topic",
    baseline: 1.9,
    target: 2.5,
    judgeAfter: { calls: null, date: "2026-10-10T00:00:00Z" },
    status: "assigned",
    result: null,
    assignedById: "u_dana",
    assignedAt: "2026-09-30T08:30:00Z",
    acknowledgedAt: null,
  },
];
