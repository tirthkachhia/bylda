import { createFileRoute } from "@tanstack/react-router";
import { A8OnboardingConnectCalls } from "@/components/lanes/lane-4/onboarding/A8OnboardingConnectCalls";

// A8 · Onboarding — Connect calls (integration states) · Figma 15:302 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/connect")({ component: A8OnboardingConnectCalls });
