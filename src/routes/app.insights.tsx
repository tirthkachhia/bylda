import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceInsights } from "@/components/app/coaching/WorkspaceInsights";
export const Route = createFileRoute("/app/insights")({ component: WorkspaceInsights });
