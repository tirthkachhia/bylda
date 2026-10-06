import type {
  BehavioralEvent,
  Call,
  CallAnalysis,
  CallReview,
  SavedView,
  TranscriptSegment,
} from "../types";
import { TEAM_MM } from "./people";

/** 8 calls — enough for C1/C2/H3/T10 lists, one of each status for the states. */
const call = (c: Partial<Call> & Pick<Call, "id" | "repId" | "repName" | "startedAt">): Call => ({
  account: { id: null, name: "Acme Logistics" },
  contactName: null,
  opportunityId: null,
  durationSec: 1800,
  type: "discovery",
  direction: "outbound",
  stageAtCall: "Discovery",
  outcome: "pending",
  coachingValue: 50,
  status: "ready",
  keyMoments: 2,
  topMoment: null,
  recordingUrl: null,
  ...c,
});

export const CALLS: Call[] = [
  call({
    id: "call_acme",
    repId: "u_jordan",
    repName: "Jordan Reyes",
    startedAt: "2026-09-28T14:00:00Z",
    durationSec: 2280,
    account: { id: "acct_acme", name: "Acme Logistics" },
    contactName: "David Park",
    opportunityId: "opp_acme",
    type: "negotiation",
    stageAtCall: "Pricing",
    coachingValue: 92,
    keyMoments: 4,
    topMoment: { label: "Lost control 18:42", tone: "regress", timestamp: "18:42" },
  }),
  call({
    id: "call_brightline",
    repId: "u_jordan",
    repName: "Jordan Reyes",
    startedAt: "2026-09-26T16:30:00Z",
    account: { id: "acct_bright", name: "Brightline Freight" },
    coachingValue: 71,
    outcome: "advanced",
    topMoment: { label: "Answered before diagnosing 07:15", tone: "attention", timestamp: "07:15" },
  }),
  call({
    id: "call_kestrel",
    repId: "u_alex",
    repName: "Alex Morgan",
    startedAt: "2026-09-29T15:00:00Z",
    account: { id: "acct_kestrel", name: "Kestrel Labs" },
    type: "demo",
    stageAtCall: "Demo",
    coachingValue: 64,
    outcome: "advanced",
    topMoment: { label: "Paused after objection 22:10", tone: "improve", timestamp: "22:10" },
  }),
  call({
    id: "call_vela",
    repId: "u_mia",
    repName: "Mia Kowalski",
    startedAt: "2026-09-29T11:00:00Z",
    account: { id: "acct_vela", name: "Vela Systems" },
    coachingValue: 58,
    keyMoments: 3,
  }),
  call({
    id: "call_ferro",
    repId: "u_sarah",
    repName: "Sarah Lin",
    startedAt: "2026-09-25T13:00:00Z",
    account: { id: "acct_ferro", name: "Ferro Metals" },
    type: "negotiation",
    stageAtCall: "Pricing",
    outcome: "won",
    coachingValue: 40,
  }),
  call({
    id: "call_lumen",
    repId: "u_theo",
    repName: "Theo Brandt",
    startedAt: "2026-09-30T09:00:00Z",
    account: { id: "acct_lumen", name: "Lumen Dental" },
    status: "processing",
    coachingValue: null,
    keyMoments: 0,
  }),
  call({
    id: "call_orchid",
    repId: "u_priya",
    repName: "Priya Nair",
    startedAt: "2026-09-24T10:00:00Z",
    account: { id: "acct_orchid", name: "Orchid Health" },
    status: "failed",
    coachingValue: null,
    keyMoments: 0,
  }),
  call({
    id: "call_northwind",
    repId: "u_nina",
    repName: "Nina Okafor",
    startedAt: "2026-09-23T10:00:00Z",
    account: { id: "acct_north", name: "Northwind Health" },
    durationSec: 40,
    status: "partial",
    coachingValue: null,
    keyMoments: 0,
  }),
];

export const SAVED_VIEWS: SavedView[] = [
  { id: "sv_worth", name: "Worth your time", filter: { teamId: TEAM_MM }, count: 3 },
  { id: "sv_pricing", name: "Pricing-stage calls", filter: { teamId: TEAM_MM }, count: 2 },
  { id: "sv_failed", name: "Needs attention", filter: { status: "failed" }, count: 1 },
];

export const TRANSCRIPT_ACME: TranscriptSegment[] = [
  {
    id: "seg1",
    speaker: "rep",
    speakerName: "Jordan Reyes",
    tStart: 1100,
    tEnd: 1118,
    text: "So with the rollout plan we covered, the annual number comes to 84k.",
  },
  {
    id: "seg2",
    speaker: "prospect",
    speakerName: "David Park",
    tStart: 1119,
    tEnd: 1122,
    text: "We already budgeted for another tool this year, and I’d need to see—",
  },
  {
    id: "seg3",
    speaker: "rep",
    speakerName: "Jordan Reyes",
    tStart: 1122,
    tEnd: 1140,
    text: "Totally, and that’s exactly why we offer a first-year discount—",
  },
  {
    id: "seg4",
    speaker: "prospect",
    speakerName: "David Park",
    tStart: 1141,
    tEnd: 1150,
    text: "It’s less the price. It’s whether my team can actually roll this out in Q4.",
  },
];

export const EVENTS_ACME: BehavioralEvent[] = [
  {
    id: "ev1",
    callId: "call_acme",
    type: "objection",
    tStart: 1119,
    tEnd: 1122,
    speaker: "prospect",
    attrs: { category: "price" },
    detectorVersion: "objection@0.1",
  },
  {
    id: "ev2",
    callId: "call_acme",
    type: "interruption",
    tStart: 1122,
    tEnd: 1123,
    speaker: "rep",
    attrs: { overlapMs: 400 },
    detectorVersion: "turns@0.1",
  },
  {
    id: "ev3",
    callId: "call_acme",
    type: "control_shift",
    tStart: 1141,
    tEnd: 1150,
    speaker: "prospect",
    attrs: {},
    detectorVersion: "control@0.1",
  },
];

export const ANALYSIS_ACME: CallAnalysis = {
  summary: "Acme's CFO raised rollout risk at 18:42; it was handled as a price objection.",
  objections: [
    { label: "Price / budget", timestamp: "18:42", handled: "poorly" },
    { label: "Implementation risk", timestamp: "19:01", handled: "unclear" },
  ],
  competitors: ["Gong"],
  nextSteps: ["Send rollout plan to David Park by Thu"],
  talkRatio: 0.61,
  sentiment: -0.1,
  // GAP: methodology — per-stage adherence has no backing (BACKEND_BACKLOG → methodology)
  methodologyAdherence: [
    { stage: "Discovery", score: 0.7 },
    { stage: "Pricing", score: 0.3 },
  ],
  analysisStatus: "completed",
  analysisVersion: 3,
};

export function mockCallReview(callId: string): CallReview | null {
  const c = CALLS.find((x) => x.id === callId);
  if (!c) return null;
  const isAcme = c.id === "call_acme";
  return {
    call: c,
    transcript: isAcme ? TRANSCRIPT_ACME : TRANSCRIPT_ACME.slice(0, 2),
    analysis: isAcme
      ? ANALYSIS_ACME
      : {
          ...ANALYSIS_ACME,
          summary: `Call with ${c.account.name}.`,
          objections: [],
          methodologyAdherence: [],
        },
    events: isAcme ? EVENTS_ACME : [],
    moments: isAcme
      ? [
          {
            callId: c.id,
            timestamp: "18:42",
            tSeconds: 1122,
            speaker: "rep",
            speakerLabel: "Jordan Reyes",
            quote: "Totally, and that’s exactly why we offer a first-year discount—",
            label: "Lost control",
            tone: "regress",
          },
        ]
      : [],
    coaching: [],
  };
}
