import { createFileRoute } from "@tanstack/react-router";
import { C3CallReviewTranscriptTimeline } from "@/components/lanes/lane-2/calls/C3CallReviewTranscriptTimeline";

// C3 · Call Review — Transcript & timeline · Figma 9:2 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/$callId/transcript")({
  component: C3CallReviewTranscriptTimeline,
});
