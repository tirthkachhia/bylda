import { createFileRoute } from "@tanstack/react-router";
import { OperatorCanvas } from "@/components/canvas/OperatorCanvas";

export const Route = createFileRoute("/app/")({
  component: OperatorCanvas,
});
