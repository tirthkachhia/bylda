import { useParams } from "@tanstack/react-router";
import type { TagTone } from "@/components/bylda";
import type { BehaviorScore, CoachingFocus, Person, Team } from "@/lib/data";
import { formatScore } from "../rep/repFormat";
import { rosterIndex, type Attention } from "./teamDemo";

/** Non-component helpers for the Team screens T1–T7 and T13. Pure functions of data-layer values. */

/** `$teamId` from the route. T2–T7 all live under /app/team/$teamId. */
export function useTeamIdParam(): string {
  const { teamId = "" } = useParams({ strict: false }) as { teamId?: string };
  return teamId;
}

/** The reps on a team, in roster order — never sorted by any score (not a leaderboard). */
export const repsOf = (team: Team, people: Person[]) =>
  people
    .filter((p) => p.role === "rep" && (p.teamId === team.id || team.repIds.includes(p.id)))
    .map((p, i) => ({ p, i: rosterIndex(p.id) ?? 1000 + i }))
    .sort((a, b) => a.i - b.i)
    .map((x) => x.p);

/** The focus that describes a rep right now: the running one, else the latest closed one. */
export function currentFocus(foci: CoachingFocus[], repId: string): CoachingFocus | null {
  const mine = foci
    .filter((f) => f.repId === repId)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  return (
    mine.find(
      (f) => f.status === "assigned" || f.status === "acknowledged" || f.status === "measuring",
    ) ??
    mine[0] ??
    null
  );
}

const FOCUS_STATE: Record<CoachingFocus["status"], string> = {
  assigned: "queued",
  acknowledged: "active",
  measuring: "measuring",
  held: "held",
  not_yet: "not yet",
  reverted: "reverted",
};

/** "Pause after objection · measuring" */
export const focusLine = (f: CoachingFocus) => `${f.behaviorName} · ${FOCUS_STATE[f.status]}`;

/** Attention → tag. Colour follows behavioral direction only (§3). */
export const ATTENTION: Record<Attention, { label: string; tone: TagTone }> = {
  coach_now: { label: "Coach now", tone: "regress" },
  watch: { label: "Watch", tone: "attention" },
  coach_soon: { label: "Coach soon", tone: "attention" },
  improving: { label: "Improving", tone: "improve" },
  strong: { label: "Strong", tone: "improve" },
  steady: { label: "Steady", tone: "neutral" },
  new: { label: "New", tone: "neutral" },
};

export const needsCoaching = (a: Attention) => a === "coach_now" || a === "coach_soon";

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** 2 → "Two"; past ten, digits. */
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** T1 headline from the counts it summarises: "Two reps need you this week. Four are improving." */
export function overviewHeadline(needs: number, improving: number): string {
  const first =
    needs === 0
      ? "No rep needs you this week."
      : `${countWord(needs)} ${needs === 1 ? "rep needs" : "reps need"} you this week.`;
  const second =
    improving === 0 ? "" : ` ${countWord(improving)} ${improving === 1 ? "is" : "are"} improving.`;
  return first + second;
}

/** A behavior value in its unit; unknown unit → the bare number. */
export const formatValue = (value: number, unit: BehaviorScore["unit"] | undefined) =>
  unit ? formatScore(value, unit) : String(value);

/**
 * T4 heatmap / T13 cells: notably better or worse than the team median for that behavior.
 * Differences under 10% of the visible range read neutral (T13 "How to read"). Unknown
 * direction → neutral: colour never guesses.
 */
export type Versus = "better" | "worse" | "neutral";
export function versusMedian(
  value: number,
  median: number,
  range: number,
  higherIsBetter: boolean | undefined,
): Versus {
  const diff = value - median;
  if (higherIsBetter === undefined || Math.abs(diff) < range * 0.1 || diff === 0) return "neutral";
  return diff > 0 === higherIsBetter ? "better" : "worse";
}

export const VERSUS_TEXT: Record<Versus, string> = {
  better: "text-by-signal-improve",
  worse: "text-by-signal-regress",
  neutral: "text-by-text-primary",
};

/** Whole days between two ISO dates. */
export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
