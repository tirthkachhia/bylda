import { createFileRoute } from "@tanstack/react-router";
import { T10RepProfileCalls } from "@/components/lanes/lane-4/team/T10RepProfileCalls";

// T10 · Rep Profile — Calls · Figma 45:1493 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/reps/$repId/calls")({
  component: T10RepProfileCalls,
});
