import { createFileRoute } from "@tanstack/react-router";
import { I9IntelligenceOutcomePatterns } from "@/components/lanes/lane-1/intelligence/I9IntelligenceOutcomePatterns";

// I9 · Intelligence — Outcome patterns · Figma 51:1819 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/outcomes")({
  component: I9IntelligenceOutcomePatterns,
});
