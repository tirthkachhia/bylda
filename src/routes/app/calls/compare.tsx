import { createFileRoute } from "@tanstack/react-router";
import { C8CallComparison } from "@/components/lanes/lane-2/calls/C8CallComparison";

// C8 · Call comparison · Figma 28:1464 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/compare")({ component: C8CallComparison });
