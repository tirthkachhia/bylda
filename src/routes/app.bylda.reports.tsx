import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy presentation removed from the Figma MVP; retained URLs resolve safely.
export const Route = createFileRoute("/app/bylda/reports")({
  beforeLoad: () => {
    throw redirect({ to: "/app/reports", replace: true });
  },
});
