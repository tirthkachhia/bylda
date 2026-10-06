import type { PatternStatus } from "@/lib/data";

/**
 * I1 PATTERN LIFECYCLE legend (Figma 27:525). These are the definitions the pattern job applies
 * (LANE_REQUESTS F-1 item 1); they are copy, not data. GAP: the thresholds live only in this
 * string and in the job — L1-2 asks for exported constants so the two can't drift.
 */
export const LIFECYCLE: { status: PatternStatus; label: string; rule: string }[] = [
  { status: "emerging", label: "Emerging", rule: "Seen < 2 weeks, n < 20" },
  { status: "confirmed", label: "Confirmed", rule: "Seen 3+ weeks, n ≥ 30" },
  { status: "fading", label: "Fading", rule: "Frequency down 40%+" },
  { status: "resolved", label: "Resolved", rule: "Back to baseline after coaching" },
];
