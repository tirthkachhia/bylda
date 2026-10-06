import { createFileRoute } from "@tanstack/react-router";
import { I11IntelligenceProspectPatterns } from "@/components/lanes/lane-1/intelligence/I11IntelligenceProspectPatterns";

// I11 · Intelligence — Prospect patterns · Figma 51:2556 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/prospects")({
  component: I11IntelligenceProspectPatterns,
});
