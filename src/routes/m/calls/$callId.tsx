import { createFileRoute } from "@tanstack/react-router";
import { B3MobileQuickCallReviewCoach } from "@/components/lanes/lane-5/mobile/B3MobileQuickCallReviewCoach";

// B3 · Mobile — Quick call review + coach · Figma 20:67 · Lane 5 (Mayur)
export const Route = createFileRoute("/m/calls/$callId")({
  component: B3MobileQuickCallReviewCoach,
});
