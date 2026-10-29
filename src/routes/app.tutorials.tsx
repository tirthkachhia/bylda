import { createFileRoute, redirect } from "@tanstack/react-router";
// The legacy tutorial presentation is outside the Figma MVP.
export const Route = createFileRoute("/app/tutorials")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
