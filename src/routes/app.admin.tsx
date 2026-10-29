import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy presentation removed from the Figma MVP; retained URLs resolve safely.
export const Route = createFileRoute("/app/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/app/settings", search: { tab: "audit" }, replace: true });
  },
});
