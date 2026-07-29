// Legacy 18-step journey — collapsed into Mission Control (Phase 3). The
// mission spine is the execution path; this page read a progress table
// nothing wrote and a step catalog retired in Phase 2.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/launchpad-path")({
  beforeLoad: () => {
    throw redirect({ to: "/app/mission-control", replace: true });
  },
});
