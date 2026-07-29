// Legacy founder dashboard — collapsed into the canonical homes (Phase 3).
// /app/ resolves the workspace mode and lands on mission-control (create)
// or bylda-home (operate), so old bookmarks keep working for both personas.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
