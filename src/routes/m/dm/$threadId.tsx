import { createFileRoute } from "@tanstack/react-router";
import { B8MobileDirectMessage } from "@/components/lanes/lane-5/mobile/B8MobileDirectMessage";

// B8 · Mobile — Direct message (Dana ↔ Jordan) · Figma 52:11495 · Lane 5 (Mayur)
export const Route = createFileRoute("/m/dm/$threadId")({ component: B8MobileDirectMessage });
