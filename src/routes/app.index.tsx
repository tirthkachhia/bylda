import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TodayBrief } from "@/components/app/TodayBrief";
import { useAuth } from "@/lib/auth";
import { coachingManagerPermissionQuery } from "@/lib/queries";

export const Route = createFileRoute("/app/")({
  validateSearch: (search: Record<string, unknown>): { view?: "start" | "brief" } => ({
    view: search.view === "start" || search.view === "brief" ? search.view : undefined,
  }),
  component: IntelligenceHome,
});

function IntelligenceHome() {
  const { currentOrgId, user } = useAuth();
  const { view } = Route.useSearch();
  const permission = useQuery(coachingManagerPermissionQuery(currentOrgId ?? "", user?.id ?? ""));
  if (currentOrgId && permission.isLoading)
    return (
      <p role="status" className="page30-pending">
        Loading intelligence…
      </p>
    );
  if (permission.isError)
    return (
      <p role="alert">
        Workspace role could not load.{" "}
        <button className="underline" onClick={() => void permission.refetch()}>
          Retry
        </button>
      </p>
    );
  const personal = permission.data === false;
  if (view === "start")
    return (
      <section
        className="page30-start"
        data-design-screen={personal ? "rep-start" : "manager-start"}
      >
        <p className="page30-label">Bylda</p>
        <h1>{personal ? "Know what to practice next." : "Start with your team brief."}</h1>
        <p>
          {personal
            ? "See your coaching focus and reviewed calls in one place."
            : "See your team’s coaching priorities and check the status of recent recordings."}
        </p>
        <Link to="/app" className="figma-button page30-primary">
          Open Intelligence
        </Link>
        <div className="page30-glass page30-report-card">
          <p className="page30-label">Find what you need</p>
          <ul className="page30-home-list">
            <li>
              <Link to="/app">Intelligence</Link>
              <span>{personal ? "Your next coaching focus" : "Team coaching priorities"}</span>
            </li>
            <li>
              <Link to="/app/crm/calls">Calls</Link>
              <span>Reviewed recordings and processing status</span>
            </li>
            <li>
              <Link to="/app/reports">Reports</Link>
              <span>Saved feedback and review periods</span>
            </li>
          </ul>
        </div>
      </section>
    );
  return <TodayBrief personal={personal} briefOnly={view === "brief" && !personal} />;
}
