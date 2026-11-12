import { createFileRoute } from "@tanstack/react-router";
import { CoachingAssignments } from "@/components/app/coaching/CoachingAssignments";

export const Route = createFileRoute("/app/coaching")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { assignment?: string; view?: "progress" } => ({
    assignment: typeof search.assignment === "string" ? search.assignment : undefined,
    view: search.view === "progress" ? ("progress" as const) : undefined,
  }),
  component: CoachingPage,
});

function CoachingPage() {
  const { assignment, view } = Route.useSearch();
  return <CoachingAssignments assignmentId={assignment} progress={view === "progress"} />;
}
