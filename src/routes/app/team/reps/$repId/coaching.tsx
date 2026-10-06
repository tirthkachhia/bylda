import { createFileRoute } from "@tanstack/react-router";
import { T11RepProfileCoaching } from "@/components/lanes/lane-4/team/T11RepProfileCoaching";

// T11 · Rep Profile — Coaching · Figma 45:1841 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/reps/$repId/coaching")({
  component: T11RepProfileCoaching,
});
