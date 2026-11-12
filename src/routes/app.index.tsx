import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TodayBrief } from "@/components/app/TodayBrief";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery } from "@/lib/queries";

export const Route = createFileRoute("/app/")({ component: IntelligenceHome });

function IntelligenceHome() {
  const { currentOrgId, user } = useAuth();
  const permission = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""));
  if (currentOrgId && permission.isLoading) return <p role="status">Loading intelligence…</p>;
  if (permission.isError)
    return (
      <p role="alert">
        Workspace role could not load.{" "}
        <button className="underline" onClick={() => void permission.refetch()}>
          Retry
        </button>
      </p>
    );
  return <TodayBrief personal={permission.data === false} />;
}
