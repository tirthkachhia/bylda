import { createFileRoute } from "@tanstack/react-router";
import { T7TeamDetailSettings } from "@/components/lanes/lane-4/team/T7TeamDetailSettings";

// T7 · Team Detail — Settings · Figma 52:3634 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/$teamId/settings")({
  component: T7TeamDetailSettings,
});
