import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FigmaEmptyPage } from "@/lib/figma-page-catalog";
import { WorkspaceInsights } from "./coaching/WorkspaceInsights";
import { CoachingAssignments } from "./coaching/CoachingAssignments";
import { WorkspaceRooms } from "./coaching/WorkspaceRooms";
import { WorkspaceTeams } from "./coaching/WorkspaceTeams";
import { WorkspaceSearch } from "./coaching/WorkspaceSearch";
import { ReportsIndex } from "./coaching/ReportsIndex";
import { TodayBrief } from "./TodayBrief";
import { FigmaNotifications } from "./FigmaNotifications";
export function ConnectedPageView({ page }: { page: FigmaEmptyPage }) {
  if (page.key === "daily-manager-brief")
    return <LiveDestination to="/app" search={{ view: "brief" }} />;
  if (page.key === "rep-home") return <LiveDestination to="/app" search={{}} />;
  if (page.key === "my-progress")
    return <LiveDestination to="/app/coaching" search={{ view: "progress" }} />;
  if (page.key === "rep-coaching") return <LiveDestination to="/app/coaching" search={{}} />;
  if (page.group === "insights")
    return (
      <WorkspaceInsights
        key={page.key}
        initialTab={
          page.key.includes("objection")
            ? "Objections"
            : page.key.includes("methodology")
              ? "Methodology"
              : page.key.includes("outcome")
                ? "Outcome patterns"
                : page.key.includes("team")
                  ? "Team behaviors"
                  : page.key.includes("emerging")
                    ? "Emerging patterns"
                    : "Overview"
        }
      />
    );
  if (page.group === "coaching")
    return (
      <CoachingAssignments
        key={page.key}
        initialFilter={
          page.key.includes("completed")
            ? "completed"
            : page.key.includes("follow")
              ? "follow_up"
              : "active"
        }
      />
    );
  if (page.group === "conversations") return <WorkspaceRooms />;
  if (page.group === "reports") return <ReportsIndex />;
  if (page.group === "search") return <WorkspaceSearch />;
  if (page.group === "notifications") return <FigmaNotifications />;
  if (page.group === "home") return <TodayBrief />;
  if (page.key.includes("team") && page.group === "people") return <WorkspaceTeams />;
  const to =
    page.group === "people" || page.group === "rep"
      ? "/app/people"
      : page.group === "integrations"
        ? "/app/integrations"
        : page.group === "setup"
          ? "/onboarding"
          : "/app/crm/calls";
  const search: Record<string, string> =
    page.group === "methodology"
      ? { view: "playbooks" }
      : page.group === "calls"
        ? { view: "calls" }
        : {};
  return <LiveDestination key={page.key} to={to} search={search} />;
}
function LiveDestination({ to, search }: { to: string; search: Record<string, string> }) {
  const navigate = useNavigate(),
    encoded = JSON.stringify(search);
  useEffect(() => {
    void navigate({ to, search: JSON.parse(encoded) } as never);
  }, [navigate, to, encoded]);
  return (
    <p role="status" className="figma-panel">
      Opening workspace data…{" "}
      <Link to={to} search={search as never} className="underline">
        Continue
      </Link>
    </p>
  );
}
