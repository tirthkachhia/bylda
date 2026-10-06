import { createFileRoute } from "@tanstack/react-router";
import { A6OnboardingWorkspaceSetup } from "@/components/lanes/lane-4/onboarding/A6OnboardingWorkspaceSetup";

// A6 · Onboarding — Workspace setup · Figma 26:784 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/workspace")({
  component: A6OnboardingWorkspaceSetup,
});
