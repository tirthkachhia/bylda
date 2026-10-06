import { createFileRoute } from "@tanstack/react-router";
import { G7CoachingDetailOverview } from "@/components/lanes/lane-2/coaching/G7CoachingDetailOverview";

// G7 · Coaching Detail — Overview · Figma 46:1604 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/coaching/$focusId/overview")({
  component: G7CoachingDetailOverview,
});
