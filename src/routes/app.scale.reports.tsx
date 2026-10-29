import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy presentation removed from the Figma MVP; retained URLs resolve safely.
export const Route = createFileRoute("/app/scale/reports")({
  beforeLoad: () => {
    throw redirect({ to: "/app/reports", replace: true });
  },
});
