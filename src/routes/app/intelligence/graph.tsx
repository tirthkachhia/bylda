import { createFileRoute } from "@tanstack/react-router";
import { I6BehavioralOutcomeGraph } from "@/components/lanes/lane-1/intelligence/I6BehavioralOutcomeGraph";

// I6 · Behavioral Outcome Graph · Figma 28:857 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/graph")({
  component: I6BehavioralOutcomeGraph,
});
