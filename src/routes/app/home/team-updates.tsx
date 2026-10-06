import { createFileRoute } from "@tanstack/react-router";
import { H2ManagerHomeTeamUpdates } from "@/components/lanes/lane-1/home/H2ManagerHomeTeamUpdates";

// H2 · Manager Home — Team Updates · Figma 43:692 · Lane 1 (Ansh)
export const Route = createFileRoute("/app/home/team-updates")({
  component: H2ManagerHomeTeamUpdates,
});
