import {
  mocksForced,
  type CallReview,
  type Confidence,
  type SignalTone,
  type TranscriptSegment,
} from "@/lib/data";

export type ReviewBehavior = {
  name: string;
  tone: SignalTone;
  tag: string;
  value: string;
  detail: string;
  observation: string;
  evidence: string;
  interpretation: string;
  next: string;
  confidence: Confidence;
  sampleSize: number;
  at: number;
  repInterpretation?: string;
  repDetail?: string;
};
export type ReviewNote = { id: string; author: string; at: number; body: string };
export type ReviewPresentation = {
  demo: boolean;
  title: string;
  contacts: string[];
  opportunity: string | null;
  summary: string | null;
  behaviors: ReviewBehavior[];
  notes: ReviewNote[];
  moments: { at: number; label: string; tone: SignalTone }[];
  transcript: TranscriptSegment[];
  good: string | null;
};
// GAP: C3–C6 presentation fields absent from CallReview. Lane-local, demo-only;
// never supplement real calls or unrelated demo accounts. See LANE_REQUESTS.
const behaviors: ReviewBehavior[] = [
  {
    name: "Objection handling",
    tone: "regress",
    tag: "Leak",
    value: "Needs improvement",
    detail: "Answered before diagnosing · Pattern in 4 of 6 objections",
    observation: "Responded 0.4s after the CFO began.",
    evidence: "“…whether my team will actually—”",
    interpretation: "Concern was rollout, not price.",
    next: "Pause, ask “will actually… what?”",
    confidence: "high",
    sampleSize: 6,
    at: 1122,
  },
  {
    name: "Interruptions",
    tone: "regress",
    tag: "Leak",
    value: "5 instances",
    detail: "↑ 100% vs Jordan’s avg · 3 during pricing",
    observation: "5 overlaps, 3 in pricing.",
    evidence: "18:44 · 19:10 · 27:06",
    interpretation: "Each came while the CFO was explaining risk.",
    next: "Let them finish; count one breath.",
    confidence: "high",
    sampleSize: 1,
    at: 1124,
  },
  {
    name: "Talk / listen",
    tone: "attention",
    tag: "Watch",
    value: "61 : 39",
    detail: "↑ 12% vs avg · 78 : 22 after 18:42",
    observation: "61 / 39 overall, 78 / 22 after 18:42.",
    evidence: "Discovery 34 / 66",
    interpretation: "Control shifted to Jordan pushing, not leading.",
    next: "Ask a question after 45s of talking.",
    confidence: "high",
    sampleSize: 1,
    at: 1122,
  },
  {
    name: "Question quality",
    tone: "improve",
    tag: "Strength",
    value: "Strong",
    detail: "9 discovery Qs · 4 follow-ups · Top 3 on team",
    repDetail: "9 discovery Qs · 4 follow-ups",
    observation: "9 discovery questions, 4 follow-ups.",
    evidence: "04:10 “What breaks between…”",
    interpretation: "Best discovery on the team this week.",
    repInterpretation: "Strong discovery questions and follow-ups.",
    next: "Keep — don’t change this.",
    confidence: "high",
    sampleSize: 1,
    at: 250,
  },
  {
    name: "Pacing",
    tone: "attention",
    tag: "Watch",
    value: "201 wpm",
    detail: "after the objection (from 168) · Rushed",
    observation: "168 → 201 wpm after objection.",
    evidence: "19:00–21:00",
    interpretation: "Speed rose alongside signs of stress.",
    next: "Slow down deliberately on price.",
    confidence: "medium",
    sampleSize: 1,
    at: 1140,
  },
  {
    name: "Framework (MEDDIC)",
    tone: "attention",
    tag: "Watch",
    value: "Partial",
    detail: "Economic buyer ✓ · Decision process ✗",
    observation: "Economic buyer ✓ · Decision process ✗",
    evidence: "No decision date asked",
    interpretation: "Deal stalled without a mapped process.",
    next: "Ask “what happens after you take it back?”",
    confidence: "medium",
    sampleSize: 1,
    at: 1244,
  },
];
export const demoTiming = {
  selected: 1122,
  objection: 1122,
  interruption: 1124,
  monologue: 1142,
  positive: 600,
};
export const demoAnnotations = {
  summaryConfidence: { sampleSize: 1, sampleLabel: "1 analyzed call" },
  objection: "◆ Objection · implementation risk",
  interruption: "| Interruption · 0.4s · Discount before diagnosis",
  monologue: "▬ Monologue 1:42",
  observation:
    "You responded to the pricing objection 0.4s after the CFO started it, and offered 12% off within 5 seconds.",
  interpretation:
    "He hadn’t finished. His concern was rollout — “whether my team will actually” adopt it — not price. The discount answered a question he didn’t ask.",
  next: "Pause. Ask: “Whether your team will actually…what?” Then handle adoption risk with the Brightline rollout story.",
  sample: "Pattern seen in 4 of Jordan’s last 6 price objections",
};
export const demoTimeline = {
  repTalk: [
    80, 129.42, 203.56, 265.34, 327.12, 401.26, 500.1, 542.12, 549.53, 606.37, 697.8, 752.17,
    846.07, 920.21,
  ],
  questions: [188.2, 225.27, 254.92, 277.16, 309.28, 349.81, 389.35, 406.65, 451.13],
  objections: [536.12, 743.7],
  interruptions: [553.12, 750.7, 806.07, 846.07],
  talk: [
    80, 109.65, 129.42, 164.02, 203.56, 218.39, 265.34, 277.7, 327.12, 341.95, 401.26, 416.08,
    500.1, 534.7, 542.12, 549.53, 591.54, 606.37, 673.09, 697.8, 747.23, 752.17, 821.36, 846.07,
    895.5, 920.21, 1024,
  ],
  stages: [
    { x: 81, w: 84.492, label: "Opening" },
    { x: 167.49, w: 331.613, label: "Discovery" },
    { x: 501.1, w: 32.597, label: "" },
    { x: 535.7, w: 358.796, label: "Pricing" },
    { x: 896.5, w: 126.503, label: "Close" },
  ],
  ticks: ["0:00", "5:00", "10:00", "15:00", "20:00", "25:00", "30:00", "35:00", "38:12"],
};
export function presentation(review: CallReview, rep = false): ReviewPresentation {
  const { call, analysis } = review;
  const demo = mocksForced() && call.id === "call_acme" && call.status === "ready";
  const base: ReviewPresentation = {
    demo: false,
    title: `${call.account.name} — ${call.type.replaceAll("_", " ")}`,
    contacts: call.contactName ? [call.contactName] : [],
    opportunity: null,
    summary: analysis.summary,
    behaviors: [],
    notes: [],
    moments: review.moments.map((m) => ({ at: m.tSeconds, label: m.label, tone: m.tone })),
    transcript: review.transcript,
    good: null,
  };
  if (!demo) return base;
  return {
    ...base,
    demo: true,
    behaviors: behaviors.map((b) => {
      const counts = review.events.filter(
        (e) => e.type === (b.name === "Interruptions" ? "interruption" : "question"),
      );
      const value =
        b.name === "Talk / listen"
          ? analysis.talkRatio === null
            ? "Unavailable"
            : `${Math.round(analysis.talkRatio * 100)} / ${Math.round((1 - analysis.talkRatio) * 100)}`
          : b.name === "Interruptions"
            ? `${counts.length} detected events`
            : b.name === "Question quality"
              ? `${counts.length} detected questions`
              : b.name === "Framework (MEDDIC)"
                ? analysis.methodologyAdherence
                    .map((s) => `${s.stage}: ${Math.round(s.score * 100)}%`)
                    .join(" · ") || "Unavailable"
                : null;
      if (value !== null)
        return {
          ...b,
          value,
          detail: "From shared call analysis",
          observation: value,
          evidence: "Shared call analysis and detected events",
          interpretation: "A qualitative assessment is not available in the shared contract.",
          next: "",
          confidence: "low" as const,
          sampleSize: 1,
          tone: "neutral" as const,
          tag: "Observed",
          at: counts[0]?.tStart ?? 0,
        };
      return {
        ...b,
        evidence:
          b.name === "Objection handling"
            ? (review.transcript.find(
                (s) =>
                  s.speaker === "prospect" &&
                  review.events.some(
                    (e) => e.type === "objection" && e.tStart >= s.tStart && e.tStart <= s.tEnd,
                  ),
              )?.text ?? "No transcript evidence available")
            : b.evidence,
        at:
          b.name === "Objection handling"
            ? (review.events.find((e) => e.type === "objection")?.tStart ?? b.at)
            : b.at,
        interpretation: rep ? (b.repInterpretation ?? b.interpretation) : b.interpretation,
        detail: rep ? (b.repDetail ?? b.detail) : b.detail,
      };
    }),
    notes: [
      {
        id: "demo-note-1",
        author: "Dana Whitfield",
        at: 1122,
        body: "He wasn’t asking for a discount yet — he was worried about rollout. That’s the whole focus this week.",
      },
      {
        id: "demo-note-2",
        author: "Jordan Reyes",
        at: 1122,
        body: "I jumped because he said “number.” Will try the question on Northwind.",
      },
      {
        id: "demo-note-3",
        author: "Dana Whitfield",
        at: 1625,
        body: "Notice it came back here — because it was never answered.",
      },
    ],
    good: "Discovery (3:30–17:00): 9 questions, 4 of them second-level. The recap at 17:58 was accurate and the prospect confirmed it — that’s the moment you had the most control.",
  };
}
export function timeLabel(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function clampTime(seconds: number, duration: number) {
  return Math.max(0, Math.min(duration, Number.isFinite(seconds) ? seconds : 0));
}
export function canCoach(role: string) {
  return ["owner", "admin", "manager", "coach"].includes(role);
}
