import { createFileRoute } from "@tanstack/react-router";
import { I7IntelligenceTeamBehaviors } from "@/components/lanes/lane-1/intelligence/I7IntelligenceTeamBehaviors";

// I7 · Intelligence — Team behaviors · Figma 51:1420 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/team-behaviors")({
  component: I7IntelligenceTeamBehaviors,
});
