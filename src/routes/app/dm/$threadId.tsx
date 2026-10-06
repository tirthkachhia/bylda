import { createFileRoute } from "@tanstack/react-router";
import { O12DirectMessageDanaJordan } from "@/components/lanes/lane-6/rooms/O12DirectMessageDanaJordan";

// O12 · Direct message — Dana ↔ Jordan · Figma 49:3123 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/dm/$threadId")({
  component: O12DirectMessageDanaJordan,
});
