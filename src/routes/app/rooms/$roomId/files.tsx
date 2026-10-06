import { createFileRoute } from "@tanstack/react-router";
import { O6RoomObjectionWatchFiles } from "@/components/lanes/lane-6/rooms/O6RoomObjectionWatchFiles";

// O6 · Room — #objection-watch · Files · Figma 48:2662 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/rooms/$roomId/files")({
  component: O6RoomObjectionWatchFiles,
});
