import { createFileRoute } from "@tanstack/react-router";
import { P3DailyManagerBriefEmail } from "@/components/lanes/lane-4/reports/P3DailyManagerBriefEmail";

// P3 · Daily Manager Brief — email (640) · Figma 13:232 · Lane 4 (Dravin)
export const Route = createFileRoute("/doc/manager-brief-email")({
  component: P3DailyManagerBriefEmail,
});
