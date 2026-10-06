import { createFileRoute } from "@tanstack/react-router";
import { A11OnboardingFirstInsight } from "@/components/lanes/lane-4/onboarding/A11OnboardingFirstInsight";

// A11 · Onboarding — First insight · Figma 16:244 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/first-insight")({
  component: A11OnboardingFirstInsight,
});
