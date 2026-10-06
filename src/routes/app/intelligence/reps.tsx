import { createFileRoute } from "@tanstack/react-router";
import { I10IntelligenceRepPatterns } from "@/components/lanes/lane-1/intelligence/I10IntelligenceRepPatterns";

// I10 · Intelligence — Rep patterns · Figma 51:2196 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/reps")({
  component: I10IntelligenceRepPatterns,
});
