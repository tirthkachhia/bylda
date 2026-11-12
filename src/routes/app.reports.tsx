import { createFileRoute } from "@tanstack/react-router";
import { ReportsIndex } from "@/components/app/coaching/ReportsIndex";

export const Route = createFileRoute("/app/reports")({
  validateSearch: (search: Record<string, unknown>): { focus?: string } => ({
    focus: typeof search.focus === "string" ? search.focus : undefined,
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return <ReportsIndex focusId={Route.useSearch().focus} />;
}
