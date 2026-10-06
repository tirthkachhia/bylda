import { createFileRoute } from "@tanstack/react-router";
import { R3CallReviewRepPerspective } from "@/components/lanes/lane-4/rep/R3CallReviewRepPerspective";

// R3 · Call Review — Rep perspective · Figma 32:334 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/rep/calls/$callId")({
  component: R3CallReviewRepPerspective,
});
