import { createFileRoute } from "@tanstack/react-router";
import { A5AuthInviteAcceptance } from "@/components/lanes/lane-4/onboarding/A5AuthInviteAcceptance";

// A5 · Auth — Invite acceptance · Figma 26:224 · Lane 4 (Dravin)
export const Route = createFileRoute("/welcome/invite")({ component: A5AuthInviteAcceptance });
