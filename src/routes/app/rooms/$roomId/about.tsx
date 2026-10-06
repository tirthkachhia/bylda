import { createFileRoute } from "@tanstack/react-router";
import { O7RoomObjectionWatchAbout } from "@/components/lanes/lane-6/rooms/O7RoomObjectionWatchAbout";

// O7 · Room — #objection-watch · About · Figma 48:3103 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/rooms/$roomId/about")({
  component: O7RoomObjectionWatchAbout,
});
