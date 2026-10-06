import { createFileRoute } from "@tanstack/react-router";
import { C5CallReviewAnalysis } from "@/components/lanes/lane-2/calls/C5CallReviewAnalysis";

// C5 · Call Review — Analysis · Figma 44:1755 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/$callId/analysis")({
  component: C5CallReviewAnalysis,
});
