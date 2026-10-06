import { createFileRoute } from "@tanstack/react-router";
import { E13MethodologyObjectionLibrary } from "@/components/lanes/lane-5/settings/E13MethodologyObjectionLibrary";

// E13 · Methodology — Objection library · Figma 31:8720 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/methodology/objections")({
  component: E13MethodologyObjectionLibrary,
});
