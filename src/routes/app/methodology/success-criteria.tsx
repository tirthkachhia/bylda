import { createFileRoute } from "@tanstack/react-router";
import { E14MethodologySuccessCriteria } from "@/components/lanes/lane-5/settings/E14MethodologySuccessCriteria";

// E14 · Methodology — Success criteria · Figma 31:8913 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/methodology/success-criteria")({
  component: E14MethodologySuccessCriteria,
});
