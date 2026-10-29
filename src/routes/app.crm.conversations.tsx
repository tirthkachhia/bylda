import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy presentation removed from the Figma MVP; retained URLs resolve safely.
export const Route = createFileRoute("/app/crm/conversations")({
  beforeLoad: () => {
    throw redirect({ to: "/app/coaching", replace: true });
  },
});
