import { createFileRoute } from "@tanstack/react-router";
import { P4DailyRepBriefEmailPush } from "@/components/lanes/lane-4/reports/P4DailyRepBriefEmailPush";

// P4 · Daily Rep Brief — email / push (60 sec) · Figma 13:316 · Lane 4 (Dravin)
export const Route = createFileRoute("/doc/rep-brief-push")({
  component: P4DailyRepBriefEmailPush,
});
