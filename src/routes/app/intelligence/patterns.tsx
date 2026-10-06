import { createFileRoute } from "@tanstack/react-router";
import { I3EmergingPatterns } from "@/components/lanes/lane-1/intelligence/I3EmergingPatterns";

// I3 · Emerging Patterns · Figma 27:567 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/intelligence/patterns")({
  component: I3EmergingPatterns,
});
