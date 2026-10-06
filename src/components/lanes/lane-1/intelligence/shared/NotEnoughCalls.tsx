import { SystemState } from "@/components/bylda";
import { TEAM_PATTERN_MIN_CALLS } from "@/lib/data";

/**
 * Team patterns start at ~50 analyzed calls per team (CLAUDE.md §4, §13.13). Below that a screen
 * shows this state, never a low-sample pattern. The count it names is the team's real one.
 */
export function NotEnoughCalls({ eyebrow, analyzed }: { eyebrow: string; analyzed: number }) {
  return (
    <SystemState
      eyebrow={eyebrow}
      tag={{ tone: "attention", label: "Low evidence" }}
      title="Not enough calls yet for team patterns."
      body={`Bylda has analyzed ${analyzed} ${analyzed === 1 ? "call" : "calls"} for this team. Patterns start at about ${TEAM_PATTERN_MIN_CALLS}.`}
    />
  );
}
