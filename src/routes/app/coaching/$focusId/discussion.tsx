import { createFileRoute } from "@tanstack/react-router";
import { G10CoachingDetailDiscussion } from "@/components/lanes/lane-2/coaching/G10CoachingDetailDiscussion";

// G10 · Coaching Detail — Discussion · Figma 46:2549 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/coaching/$focusId/discussion")({
  component: G10CoachingDetailDiscussion,
});
