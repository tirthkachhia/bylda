import { createFileRoute } from "@tanstack/react-router";
import { T3TeamDetailReps } from "@/components/lanes/lane-4/team/T3TeamDetailReps";

// T3 · Team Detail — Reps · Figma 52:2125 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/$teamId/reps")({ component: T3TeamDetailReps });
