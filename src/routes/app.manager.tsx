import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery } from "@/lib/queries";
import { TodayBrief } from "@/components/app/TodayBrief";

export const Route = createFileRoute("/app/manager")({ component: ManagerHome });

function ManagerHome() {
  const { currentOrgId, user } = useAuth();
  const permission = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""));
  if (permission.isPending) return <p role="status">Checking manager access…</p>;
  if (permission.isError)
    return (
      <p role="alert">
        Manager access could not load.{" "}
        <button className="underline" onClick={() => void permission.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!permission.data)
    return (
      <section className="figma-panel space-y-4 p-6">
        <h1>Manager access required</h1>
        <p>Ask your workspace owner for a manager invitation, or choose a workspace you manage.</p>
        <Link className="figma-button" to="/app">
          Open my workspace
        </Link>
      </section>
    );
  return <TodayBrief />;
}
