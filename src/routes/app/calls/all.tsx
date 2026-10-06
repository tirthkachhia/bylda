import { createFileRoute } from "@tanstack/react-router";
import { C2CallsIndexAllCallsFiltersOpen } from "@/components/lanes/lane-2/calls/C2CallsIndexAllCallsFiltersOpen";

// C2 · Calls Index — All calls + filters open · Figma 52:8665 · Lane 2 (Mayur)
export const Route = createFileRoute("/app/calls/all")({
  component: C2CallsIndexAllCallsFiltersOpen,
});
