import type { Source } from "../core/source";

/**
 * hybrid — identity (auth user, profile, org) and owner/admin are REAL
 * (organization_members.role). The V1 roles manager / rep / viewer / coach are read
 * from workspace_member_roles.role when it holds one; otherwise least privilege (rep).
 * Teams are MISSING (GAPS 09) — team is null in real mode until backend/teams lands.
 */
export const SOURCE: Source = "hybrid";
