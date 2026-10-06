import { createFileRoute } from "@tanstack/react-router";
import { G4CoachingNeedsFollowUp } from "@/components/lanes/lane-2/coaching/G4CoachingNeedsFollowUp";

// G4 · Coaching — Needs follow-up · Figma 52:6380 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/coaching/follow-up")({
  component: G4CoachingNeedsFollowUp,
});
