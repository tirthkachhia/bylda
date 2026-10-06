import { mocksForced } from "@/lib/data";

// GAP: nothing in the data layer says who sent an invite — `team-invite` calls Supabase
// `inviteUserByEmail` with no metadata, and `Viewer` has no `invitedBy` (LANE_REQUESTS.md #21).
// This Figma fixture (Acme Revenue) renders ONLY with VITE_BYLDA_MOCKS=true; live mode says
// "You're invited to <workspace>" without a name. Never show it against a real workspace.

/** The person who sent the invite, or null outside forced mocks. */
export function inviteSender(): { name: string } | null {
  return mocksForced() ? { name: "Dana Whitfield" } : null;
}
