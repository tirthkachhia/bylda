import { createFileRoute } from "@tanstack/react-router";
import { B6MobileMomentPlayer } from "@/components/lanes/lane-5/mobile/B6MobileMomentPlayer";

// B6 · Mobile — Moment player (Rep) · Figma 32:646 · Lane 5 (Mayur)
export const Route = createFileRoute("/m/moments/$momentId")({ component: B6MobileMomentPlayer });
