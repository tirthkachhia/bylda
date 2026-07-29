// Legacy AI dashboard — collapsed into Bylda Home (Phase 3). The briefing
// summary now renders there as AiBriefingCard; the deep view is retired.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/ai-dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/app/bylda-home", replace: true });
  },
});
