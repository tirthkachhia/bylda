// Legacy galaxy map — collapsed into Mission Control (Phase 3). Module
// progress lives in the Academy; stage/level live on the canonical home.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/galaxy")({
  beforeLoad: () => {
    throw redirect({ to: "/app/mission-control", replace: true });
  },
});
