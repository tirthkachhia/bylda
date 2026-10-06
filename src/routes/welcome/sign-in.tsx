import { createFileRoute } from "@tanstack/react-router";
import { A1AuthSignIn } from "@/components/lanes/lane-4/onboarding/A1AuthSignIn";

// A1 · Auth — Sign in · Figma 26:40 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/sign-in")({ component: A1AuthSignIn });
