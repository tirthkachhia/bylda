import { createFileRoute } from "@tanstack/react-router";
import { LocalRoomKindRoute } from "@/components/lanes/lane-6/rooms/LocalRoomKindRoute";

// O2 · Room — #objection-watch · Figma 18:2 · Lane 6 (Lane 6)
export const Route = createFileRoute("/app/rooms/$roomId/")({ component: LocalRoomKindRoute });
