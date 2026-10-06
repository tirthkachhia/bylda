import { createFileRoute } from "@tanstack/react-router";
import { I2BehaviorDetailInterruptingDuringObjections } from "@/components/lanes/lane-1/intelligence/I2BehaviorDetailInterruptingDuringObjections";

// I2 · Behavior Detail — Interrupting during objections · Figma 11:2 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/behaviors/$behaviorKey")({
  component: I2BehaviorDetailInterruptingDuringObjections,
});
