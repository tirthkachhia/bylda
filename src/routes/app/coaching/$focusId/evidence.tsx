import { createFileRoute } from "@tanstack/react-router";
import { G8CoachingDetailEvidence } from "@/components/lanes/lane-2/coaching/G8CoachingDetailEvidence";

// G8 · Coaching Detail — Evidence · Figma 46:1935 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/coaching/$focusId/evidence")({
  component: G8CoachingDetailEvidence,
});
