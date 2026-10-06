import { StateError, SystemState, systemStates } from "@/components/bylda";
import {
  ForbiddenForRoleError,
  useTeam,
  useTeamMembers,
  type Methodology,
  type Person,
  type Team,
} from "@/lib/data";
import { repsOf } from "./teamFormat";

/** Data + error helpers shared by T1–T7 and T13 (no components exported, for fast refresh). */

export type TeamView = { team: Team; people: Person[]; reps: Person[] };

// ── data ──────────────────────────────────────────────────────────────────────

/**
 * Team + everyone in the org, combined into one boundary-friendly result. The rep list is
 * derived from the team (roster order, never by score).
 */
export function useTeamView(teamId: string) {
  const team = useTeam(teamId);
  const people = useTeamMembers(null);
  const data: TeamView | undefined =
    team.data && people.data
      ? { team: team.data, people: people.data, reps: repsOf(team.data, people.data) }
      : undefined;
  return {
    data,
    isLoading: team.isLoading || people.isLoading,
    error: team.error ?? people.error,
    isEmpty: team.data === null,
    refetch: () => {
      void team.refetch();
      void people.refetch();
    },
  };
}

export const activeMethodology = (ms: Methodology[] | undefined) =>
  ms?.find((m) => m.isActive) ?? ms?.[0] ?? null;

/** "MEDDIC (template)" for a template, the methodology's own name otherwise. */
export const methodologyLabel = (m: Methodology, long: boolean) =>
  m.template === "custom"
    ? m.name
    : long
      ? `${m.template.toUpperCase()} (template)`
      : m.template.toUpperCase();

/** Error state for a team view. A rep who reaches one gets Y9 — team views are manager-only (§4). */
export function teamError(eyebrow: string, err: unknown, retry: () => void) {
  if (err instanceof ForbiddenForRoleError)
    return (
      <SystemState
        {...systemStates.permissionDenied()}
        eyebrow="TEAM · PERMISSION DENIED"
        title="Team views are for managers."
        body="Reps see their own calls, coaching and progress. Nobody on the team sees a ranking."
        actions={[{ label: "Go to my home", variant: "ghost", href: "/app/rep" }]}
      />
    );
  return (
    <StateError
      eyebrow={eyebrow}
      body="Bylda couldn’t load this team. Try again in a moment."
      onRetry={retry}
    />
  );
}
