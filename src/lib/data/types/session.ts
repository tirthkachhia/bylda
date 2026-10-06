import type { ID } from "./common";

/** V1 roles (Figma page 20 roles column + Settings → Roles). */
export type Role = "owner" | "admin" | "manager" | "rep" | "viewer" | "coach";

export type Presence = "active" | "on_call" | "away" | "paused";

/** The signed-in person, their workspace and (for managers/reps) their team. */
export type Viewer = {
  id: ID;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  /** "Manager · Mid-Market AE" — the profile-menu subtitle. */
  subtitle: string;
  presence: Presence;
  orgId: ID | null;
  workspace: { id: ID; name: string } | null;
  team: { id: ID; name: string; repCount: number } | null;
};

export type WorkspaceSummary = { id: ID; name: string; isCurrent: boolean; initials: string };
export type TeamSummary = {
  id: ID;
  name: string;
  repCount: number;
  status: "active" | "setup";
  short: string;
};
