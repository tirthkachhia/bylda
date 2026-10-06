import { createFileRoute } from "@tanstack/react-router";
import { T4TeamDetailBehaviors } from "@/components/lanes/lane-4/team/T4TeamDetailBehaviors";

// T4 · Team Detail — Behaviors · Figma 52:2520 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/$teamId/behaviors")({
  component: T4TeamDetailBehaviors,
});
