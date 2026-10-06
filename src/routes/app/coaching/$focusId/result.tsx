import { createFileRoute } from "@tanstack/react-router";
import { G12BehaviorChangeResultAlexMorgan } from "@/components/lanes/lane-2/coaching/G12BehaviorChangeResultAlexMorgan";

// G12 · Behavior Change Result — Alex Morgan · Figma 14:224 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/coaching/$focusId/result")({
  component: G12BehaviorChangeResultAlexMorgan,
});
