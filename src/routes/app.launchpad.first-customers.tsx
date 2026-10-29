import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy presentation removed from the Figma MVP; retained URLs resolve safely.
export const Route = createFileRoute("/app/launchpad/first-customers")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
