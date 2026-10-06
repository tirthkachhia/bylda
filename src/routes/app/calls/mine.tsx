import { createFileRoute } from "@tanstack/react-router";
import { C9CallsRepView } from "@/components/lanes/lane-2/calls/C9CallsRepView";

// C9 · Calls — Rep view (my calls) · Figma 28:1646 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/mine")({ component: C9CallsRepView });
