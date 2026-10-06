import { createFileRoute } from "@tanstack/react-router";
import { P9BehaviorReportObjectionHandling } from "@/components/lanes/lane-4/reports/P9BehaviorReportObjectionHandling";

// P9 · Behavior Report — Objection handling · Figma 29:993 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/reports/behavior/$behaviorKey")({
  component: P9BehaviorReportObjectionHandling,
});
