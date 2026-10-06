import { createFileRoute } from "@tanstack/react-router";
import { G9CoachingDetailProgress } from "@/components/lanes/lane-2/coaching/G9CoachingDetailProgress";

// G9 · Coaching Detail — Progress · Figma 46:2244 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/coaching/$focusId/progress")({
  component: G9CoachingDetailProgress,
});
