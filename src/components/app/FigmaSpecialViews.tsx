import { FigmaNotifications } from "./FigmaNotifications";
import { AssignmentForm } from "./coaching/CoachingAssignments";
import { WorkspaceRooms } from "./coaching/WorkspaceRooms";
import { WorkspaceSearch } from "./coaching/WorkspaceSearch";
import { Link } from "@tanstack/react-router";
export function FigmaSpecialView({ screen }: { screen: string }) {
  if (screen === "assign-coaching") return <AssignmentForm />;
  if (screen === "new-room") return <WorkspaceRooms create />;
  if (screen === "command-search") return <WorkspaceSearch />;
  if (screen === "ask-bylda") return <WorkspaceSearch ask />;
  if (screen === "notification-drawer") return <FigmaNotifications variant="drawer" />;
  return (
    <section className="figma-panel">
      <h1>Page not found</h1>
      <Link className="figma-button" to="/app">
        Back to Home
      </Link>
    </section>
  );
}
