import { supabase } from "@/integrations/supabase/client";

export type LoginWorkspace = { organization_id: string; role: string };

export function chooseLoginWorkspace(
  memberships: LoginWorkspace[],
  manager: boolean,
  preferred: string | null,
  agentOrganizations: string[] = [],
) {
  const allowed = manager
    ? memberships.filter((m) => ["owner", "admin", "manager"].includes(m.role))
    : memberships;
  return (
    allowed.find((m) => m.organization_id === preferred) ??
    allowed.find((m) =>
      manager ? m.role === "manager" : agentOrganizations.includes(m.organization_id),
    ) ??
    allowed[0]
  );
}

export async function configureLoginWorkspace(userId: string, manager: boolean) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  // The reps schema is newer than the generated Supabase types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reps, error: repError } = await (supabase as any)
    .from("reps")
    .select("organization_id")
    .eq("user_id", userId);
  if (repError) throw repError;
  let preferred: string | null = null;
  try {
    preferred = sessionStorage.getItem(`bylda-workspace:${userId}`);
  } catch {
    /* Optional preference. */
  }
  const workspace = chooseLoginWorkspace(
    data ?? [],
    manager,
    preferred,
    (reps ?? []).map((r: { organization_id: string }) => r.organization_id),
  );
  if (manager && !workspace)
    throw new Error(
      "This account has no manager access. Ask your workspace owner for a manager invitation.",
    );
  if (workspace) {
    try {
      sessionStorage.setItem(`bylda-workspace:${userId}`, workspace.organization_id);
    } catch {
      /* Membership is always checked by the server. */
    }
  }
  return workspace;
}
