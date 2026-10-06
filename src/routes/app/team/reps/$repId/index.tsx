import { createFileRoute } from "@tanstack/react-router";
import { T8RepProfileJordanReyes } from "@/components/lanes/lane-4/team/T8RepProfileJordanReyes";

// T8 · Rep Profile — Jordan Reyes (manager view) · Figma 12:271 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/team/reps/$repId/")({
  component: T8RepProfileJordanReyes,
});
