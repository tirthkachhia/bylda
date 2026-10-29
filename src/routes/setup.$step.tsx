import { createFileRoute } from "@tanstack/react-router";
import { FigmaSetupScreen } from "@/components/app/FigmaSetupScreens";
export const Route = createFileRoute("/setup/$step")({ component: SetupPage });
function SetupPage() {
  return <FigmaSetupScreen step={Route.useParams().step} />;
}
