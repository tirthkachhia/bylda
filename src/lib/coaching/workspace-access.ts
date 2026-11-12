import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery, repsQuery } from "@/lib/queries";

export function useCoachingWorkspaceAccess() {
  const { currentOrgId, user } = useAuth();
  const org = currentOrgId ?? "";
  const manager = useQuery(coachingManagerPermissionQuery(org, user?.id ?? ""));
  const reps = useQuery({
    ...repsQuery(org),
    enabled: Boolean(org && manager.data === false && user?.id),
  });
  const linkedRep =
    user?.id && manager.data === false
      ? reps.data?.find((rep) => rep.user_id === user.id)
      : undefined;
  return {
    manager: manager.data === true,
    rep: linkedRep,
    pending: manager.isLoading || reps.isLoading,
    error: manager.error ?? reps.error,
    retry: () => (manager.error ? manager.refetch() : reps.refetch()),
  };
}
