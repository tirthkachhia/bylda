import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/pricing")({
  beforeLoad: () => {
    throw redirect({ to: "/app/settings", search: { tab: "plan" }, replace: true });
  },
});
