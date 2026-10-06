import { Link } from "@tanstack/react-router";
import { Avatar, SkeletonBlock, Tag } from "@/components/bylda";
import {
  useCoachingFoci,
  useTeam,
  useTeamMembers,
  useTeams,
  type CoachingFocus,
  type Person,
  type TeamSummary,
} from "@/lib/data";
import { firstNameOf } from "../shared/format";
import { isActiveFocus } from "./summary";

/** Same six columns, header and rows (Figma 31:10062). */
const COLS = "grid grid-cols-[160px_130px_60px_120px_100px_110px] items-center";

/**
 * Adoption by team. Brief open rate and trajectory have no source in `@/lib/data`, so they read
 * "—" rather than a number — LANE_REQUESTS #52. A team still in setup gets the "Set up" tag where
 * the trajectory goes, as in the Figma.
 */
export function AdoptionTable() {
  const teams = useTeams();
  const people = useTeamMembers();
  const foci = useCoachingFoci();

  return (
    <section className="w-full overflow-hidden rounded-by-card border border-by-border-engraved bg-by-surface-raised">
      <h2 className="type-ui-label border-b border-by-border-engraved px-4 py-3 text-by-text-primary">
        ADOPTION BY TEAM
      </h2>
      <div className="overflow-x-auto">
        <div className="min-w-[712px]">
          <div
            className={`${COLS} type-mono-micro border-b border-by-border-engraved bg-by-surface-inset px-4 py-[9px] text-by-text-tertiary`}
          >
            <span>TEAM</span>
            <span>MANAGER</span>
            <span>REPS</span>
            <span>BRIEF OPEN RATE</span>
            <span>COACHING</span>
            <span>TRAJECTORY</span>
          </div>
          {teams.isLoading ? (
            <SkeletonBlock height={129} />
          ) : (
            (teams.data ?? []).map((t) => (
              <TeamRow key={t.id} team={t} people={people.data ?? []} foci={foci.data ?? []} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function TeamRow({
  team,
  people,
  foci,
}: {
  team: TeamSummary;
  people: Person[];
  foci: CoachingFocus[];
}) {
  const detail = useTeam(team.id);
  const manager = people.find((p) => p.id === detail.data?.managerId);
  const repIds = new Set(detail.data?.repIds ?? []);
  const active = foci.filter((f) => repIds.has(f.repId) && isActiveFocus(f)).length;
  const setUp = team.status === "active";

  return (
    <div className={`${COLS} border-b border-by-border-engraved px-4 py-2.5 last:border-b-0`}>
      <Link
        to="/app/team/$teamId"
        params={{ teamId: team.id }}
        className="type-ui-body-strong text-by-text-primary hover:underline"
      >
        {team.name}
      </Link>
      {manager ? (
        <span className="flex items-center gap-2">
          <Avatar name={manager.name} size={22} />
          <span className="type-ui-body-strong text-by-text-primary">
            {firstNameOf(manager.name)}
          </span>
        </span>
      ) : (
        <span className="type-ui-small text-by-text-tertiary">—</span>
      )}
      <span className="type-mono-data text-by-text-secondary">{team.repCount}</span>
      <span className="type-mono-data text-by-text-secondary">—</span>
      <span className="type-mono-data text-by-text-secondary">
        {setUp && detail.data ? `${active} active` : "—"}
      </span>
      <span>
        {setUp ? (
          <span className="type-mono-data text-by-text-secondary">—</span>
        ) : (
          <Tag>Set up</Tag>
        )}
      </span>
    </div>
  );
}
