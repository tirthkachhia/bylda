import { createFileRoute } from "@tanstack/react-router";
import { A2AuthSignUp } from "@/components/lanes/lane-4/onboarding/A2AuthSignUp";

// A2 · Auth — Sign up · Figma 26:91 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/sign-up")({ component: A2AuthSignUp });
