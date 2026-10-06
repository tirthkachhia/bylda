import { createFileRoute } from "@tanstack/react-router";
import { B4MobileCoachingAcknowledge } from "@/components/lanes/lane-5/mobile/B4MobileCoachingAcknowledge";

// B4 · Mobile — Coaching acknowledge (Rep) · Figma 32:572 · Lane 5 (Mayur)
export const Route = createFileRoute("/m/coaching/$focusId")({
  component: B4MobileCoachingAcknowledge,
});
