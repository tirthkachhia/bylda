import { createFileRoute } from "@tanstack/react-router";
import { O3RoomObjectionWatchInsights } from "@/components/lanes/lane-6/rooms/O3RoomObjectionWatchInsights";

// O3 · Room — #objection-watch · Insights · Figma 48:1283 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/rooms/$roomId/insights")({
  component: O3RoomObjectionWatchInsights,
});
