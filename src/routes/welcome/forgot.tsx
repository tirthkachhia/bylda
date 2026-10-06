import { createFileRoute } from "@tanstack/react-router";
import { A4AuthForgotPassword } from "@/components/lanes/lane-4/onboarding/A4AuthForgotPassword";

// A4 · Auth — Forgot password · Figma 26:184 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/forgot")({ component: A4AuthForgotPassword });
