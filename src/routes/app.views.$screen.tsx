import { createFileRoute } from "@tanstack/react-router";
import { figmaPageByKey } from "@/lib/figma-page-catalog";
import { ConnectedPageView } from "@/components/app/ConnectedPageView";
import { FigmaSpecialView } from "@/components/app/FigmaSpecialViews";

export const Route = createFileRoute("/app/views/$screen")({ component: PageView });
function PageView() {
  const { screen } = Route.useParams();
  const page = figmaPageByKey(screen);
  if (page) return <ConnectedPageView page={page} />;
  return <FigmaSpecialView key={screen} screen={screen} />;
}
