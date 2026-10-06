import { createFileRoute } from "@tanstack/react-router";
import { T5TeamDetailCoaching } from "@/components/lanes/lane-4/team/T5TeamDetailCoaching";

// T5 · Team Detail — Coaching · Figma 52:2928 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/$teamId/coaching")({
  component: T5TeamDetailCoaching,
});
