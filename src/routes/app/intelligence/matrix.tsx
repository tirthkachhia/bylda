import { createFileRoute } from "@tanstack/react-router";
import { I5BehaviorXOutcomeMatrix } from "@/components/lanes/lane-1/intelligence/I5BehaviorXOutcomeMatrix";

// I5 · Behavior × Outcome matrix · Figma 28:641 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/matrix")({
  component: I5BehaviorXOutcomeMatrix,
});
