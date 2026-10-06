import { createFileRoute } from "@tanstack/react-router";
import { T12RepProfileTrends } from "@/components/lanes/lane-4/team/T12RepProfileTrends";

// T12 · Rep Profile — Trends · Figma 45:2142 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/reps/$repId/trends")({
  component: T12RepProfileTrends,
});
