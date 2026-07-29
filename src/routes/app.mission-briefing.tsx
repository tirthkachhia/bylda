// Legacy mission briefing — collapsed into Mission Control (Phase 3).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/mission-briefing")({
  beforeLoad: () => {
    throw redirect({ to: "/app/mission-control", replace: true });
  },
});
