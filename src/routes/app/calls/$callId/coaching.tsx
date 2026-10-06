import { createFileRoute } from "@tanstack/react-router";
import { C6CallReviewCoaching } from "@/components/lanes/lane-2/calls/C6CallReviewCoaching";

// C6 · Call Review — Coaching · Figma 44:2146 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/$callId/coaching")({
  component: C6CallReviewCoaching,
});
