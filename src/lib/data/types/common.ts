/** Shared view-model primitives. Screens see these shapes in every SOURCE mode. */
export type ID = string;
/** ISO-8601 timestamp */
export type ISODate = string;
export type Confidence = "low" | "medium" | "high";
export type Direction = "improving" | "regressing" | "steady";
export type SignalTone = "improve" | "regress" | "attention" | "info" | "neutral";

/** A moment in a call that backs an insight. `timestamp` is "mm:ss", `tSeconds` the same in seconds. */
export type EvidenceRef = {
  callId: ID;
  timestamp: string;
  tSeconds: number;
  speaker: "rep" | "prospect" | "other";
  speakerLabel: string;
  quote: string;
};

/** A fixed-range series, so "a steady rep looks steady" (CLAUDE.md §4). */
export type Sparkline = { points: number[]; yMin: number; yMax: number };

export type Page<T> = { items: T[]; total: number };
