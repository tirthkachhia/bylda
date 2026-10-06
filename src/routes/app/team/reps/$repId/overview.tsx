import { createFileRoute } from "@tanstack/react-router";
import { T9RepProfileOverview } from "@/components/lanes/lane-4/team/T9RepProfileOverview";

// T9 · Rep Profile — Overview · Figma 45:1147 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/reps/$repId/overview")({
  component: T9RepProfileOverview,
});
