import { createFileRoute } from "@tanstack/react-router";
import { T6TeamDetailCalls } from "@/components/lanes/lane-4/team/T6TeamDetailCalls";

// T6 · Team Detail — Calls · Figma 52:3276 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/$teamId/calls")({ component: T6TeamDetailCalls });
