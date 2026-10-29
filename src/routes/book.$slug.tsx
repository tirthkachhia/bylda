import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/book/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
