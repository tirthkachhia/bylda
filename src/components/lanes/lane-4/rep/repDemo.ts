import { mocksForced, type Confidence, type SignalTone } from "@/lib/data";

// GAP: R1–R3 show copy that has no field in the data layer (LANE_REQUESTS.md #30):
//   R1 — a rep daily-brief narrative, the focus headline / "why it matters" / "try this",
//        "day N of M", per-call listen notes + windows, weekly talk/objection/control stats,
//        the coach's display name (CoachingFocus has only `assignedById`).
//   R3 — call title + participant roles, the rep-facing read ("what you did well",
//        "where you lost the call", "try this next time").
// These Figma fixtures (Acme Revenue · Jordan Reyes) render ONLY with VITE_BYLDA_MOCKS=true.
// Live mode hides each block or falls back to the nearest real field. Never shown against
// a real workspace. Rewritten per CLAUDE.md §13.10: no peer comparison in a rep view.

type Stat = { label: string; value: string; tone: SignalTone };

const BRIEF = {
  // §13.10: Figma said "…were the best on the team" — a peer ranking. Self-comparison instead.
  text: "Yesterday you ran strong discovery on 3 of 4 calls — your follow-up questions on Brightline were your best this month. But you lost control during pricing on Acme Logistics and Kestrel Labs. Same moment both times.",
  confidence: "high" as Confidence,
  sampleSize: 4,
  sampleLabel: "n = 4 calls yesterday",
};

const FOCUS: Record<string, { headline: string; why: string; tryThis: string; day: string }> = {
  cf_jordan_pause: {
    headline: "After an objection, pause before you respond.",
    why: "On your calls, answering in under a second came right before the prospect repeated the objection — 5 of 6 times. When you paused, they told you the real concern.",
    tryThis:
      "One breath. Then: “When you say price — what’s behind that?” Don’t mention discount until they answer.",
    day: "DAY 2 OF 10",
  },
};

// `tone` overrides the fixture top moment's tone where Figma's note reads the other way (LANE_REQUESTS 31 b).
const LISTEN: Record<string, { length: string; note: string; window: string; tone?: SignalTone }> =
  {
    call_acme: {
      length: "90s",
      note: "You interrupted the CFO mid-sentence and offered a discount.",
      window: "18:42 → 20:10",
    },
    call_brightline: {
      length: "3m",
      note: "Your best discovery sequence this month. Worth hearing why.",
      window: "06:15 → 09:02",
      tone: "improve",
    },
  };

const WEEK: Stat[] = [
  { label: "Calls analyzed", value: "14", tone: "neutral" },
  { label: "Talk / listen", value: "58 / 42", tone: "neutral" },
  { label: "Objections faced", value: "9", tone: "neutral" },
  { label: "Held control", value: "3 of 9", tone: "regress" },
  { label: "Next step booked", value: "12 of 14", tone: "improve" },
];

const PEOPLE: Record<string, string> = { u_dana: "Dana Whitfield", u_kiran: "Kiran Patel" };

const CALL_READ: Record<
  string,
  {
    title: string;
    roles: Record<string, string>;
    extraParticipants: string[];
    didWell: string;
    lostIt: string;
    tryThis: { line: string; then: string };
    confidence: Confidence;
    sampleLabel: string;
  }
> = {
  call_acme: {
    title: "Pricing follow-up",
    roles: { "David Park": "CFO" },
    extraParticipants: ["Sarah Cole (Ops)"],
    didWell:
      "Discovery was strong: 9 questions, 4 of them follow-ups. Your recap at 17:58 was accurate — that’s where you had the most control.",
    lostIt:
      "At 18:42 you answered before David finished. His concern was rollout, not price. The discount answered a question he didn’t ask.",
    tryThis: {
      line: "Pause. Then: “Whether your team will actually… what?”",
      then: "Then tell the Brightline rollout story.",
    },
    confidence: "high",
    sampleLabel: "this call · 14 questions",
  },
};

export const demoBrief = () => (mocksForced() ? BRIEF : null);
export const demoFocus = (focusId: string) => (mocksForced() ? (FOCUS[focusId] ?? null) : null);
export const demoListen = (callId: string) => (mocksForced() ? (LISTEN[callId] ?? null) : null);
export const demoListenTotal = () => (mocksForced() ? "7 min" : null);
export const demoWeek = (): Stat[] => (mocksForced() ? WEEK : []);
export const demoPersonName = (id: string) => (mocksForced() ? (PEOPLE[id] ?? null) : null);
export const demoCallRead = (callId: string) =>
  mocksForced() ? (CALL_READ[callId] ?? null) : null;
