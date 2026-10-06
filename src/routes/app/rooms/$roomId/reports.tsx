import { createFileRoute } from "@tanstack/react-router";
import { O5RoomObjectionWatchReports } from "@/components/lanes/lane-6/rooms/O5RoomObjectionWatchReports";

// O5 · Room — #objection-watch · Reports · Figma 48:2213 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/rooms/$roomId/reports")({
  component: O5RoomObjectionWatchReports,
});
