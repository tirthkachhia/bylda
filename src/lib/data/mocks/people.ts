import type { Person, TeamSummary, Viewer, WorkspaceSummary } from "../types";
import type { Role } from "../types/session";

/**
 * Acme Revenue — the one fixture every mock uses (CLAUDE.md §5).
 * Kiran Patel owner · Dana Whitfield manager · Mid-Market AE team of 9 · Jordan Reyes rep.
 * MINIMAL by design: enough rows to render each screen and its states, nothing more.
 */
export const ORG_ID = "org_acme";
export const WORKSPACE = { id: "ws_acme", name: "Acme Revenue" } as const;
export const TEAM_MM = "team_mm";
export const TEAM_ENT = "team_ent";
export const TEAM_SDR = "team_sdr";

const p = (
  id: string,
  name: string,
  role: Role,
  title: string | null,
  teamId: string | null,
  presence: Person["presence"] = null,
): Person => ({
  id,
  name,
  firstName: name.split(" ")[0],
  role,
  title,
  avatarUrl: null,
  presence,
  teamId,
});

export const PEOPLE: Person[] = [
  p("u_kiran", "Kiran Patel", "owner", "CRO", null, "active"),
  p("u_dana", "Dana Whitfield", "manager", "Manager · Mid-Market AE", TEAM_MM, "active"),
  p("u_riley", "Riley Chen", "coach", "Enablement", null),
  p("u_grace", "Grace Liu", "viewer", "VP Sales", null),
  p("u_omar", "Omar Reed", "admin", "RevOps", null),
  // Mid-Market AE — 9 reps
  p("u_jordan", "Jordan Reyes", "rep", "Account Executive", TEAM_MM, "on_call"),
  p("u_alex", "Alex Morgan", "rep", "Account Executive", TEAM_MM, "active"),
  p("u_mia", "Mia Kowalski", "rep", "Account Executive", TEAM_MM, "active"),
  p("u_sarah", "Sarah Lin", "rep", "Account Executive", TEAM_MM, "away"),
  p("u_theo", "Theo Brandt", "rep", "Account Executive", TEAM_MM),
  p("u_priya", "Priya Nair", "rep", "Account Executive", TEAM_MM),
  p("u_nina", "Nina Okafor", "rep", "Account Executive", TEAM_MM),
  p("u_marcus", "Marcus Hale", "rep", "Account Executive", TEAM_MM),
  p("u_leo", "Leo Park", "rep", "Account Executive", TEAM_MM),
];

export const MM_REP_IDS = PEOPLE.filter((x) => x.teamId === TEAM_MM && x.role === "rep").map(
  (x) => x.id,
);

export const personById = (id: string) => PEOPLE.find((x) => x.id === id);

export const TEAMS: TeamSummary[] = [
  { id: TEAM_MM, name: "Mid-Market AE", repCount: 9, status: "active", short: "MM" },
  { id: TEAM_ENT, name: "Enterprise", repCount: 4, status: "active", short: "ENT" },
  { id: TEAM_SDR, name: "SDR", repCount: 0, status: "setup", short: "SD" },
];

export const WORKSPACES: WorkspaceSummary[] = [
  { id: WORKSPACE.id, name: WORKSPACE.name, isCurrent: true, initials: "AR" },
  { id: "ws_sandbox", name: "Nova OPS (sandbox)", isCurrent: false, initials: "NO" },
];

/** Which fixture person is "you" for each role in mock mode. */
export const VIEWER_BY_ROLE: Record<Role, string> = {
  owner: "u_kiran",
  admin: "u_omar",
  manager: "u_dana",
  rep: "u_jordan",
  viewer: "u_grace",
  coach: "u_riley",
};

export function mockViewer(role: Role = "manager"): Viewer {
  const person = personById(VIEWER_BY_ROLE[role])!;
  const team = person.teamId ? TEAMS.find((t) => t.id === person.teamId)! : TEAMS[0];
  const roleLabel = role[0].toUpperCase() + role.slice(1);
  return {
    id: person.id,
    name: person.name,
    email: `${person.firstName.toLowerCase()}@acme-revenue.test`,
    avatarUrl: null,
    role,
    subtitle: `${roleLabel} · ${team.name}`,
    presence: "active",
    orgId: ORG_ID,
    workspace: { id: WORKSPACE.id, name: WORKSPACE.name },
    team: { id: team.id, name: team.name, repCount: team.repCount },
  };
}
