import { createFileRoute } from "@tanstack/react-router";
import { O4RoomObjectionWatchCalls } from "@/components/lanes/lane-6/rooms/O4RoomObjectionWatchCalls";

// O4 · Room — #objection-watch · Calls · Figma 48:1732 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/rooms/$roomId/calls")({
  component: O4RoomObjectionWatchCalls,
});
