import { createFileRoute } from "@tanstack/react-router";
import { P7WeeklyRepReportJordan } from "@/components/lanes/lane-4/reports/P7WeeklyRepReportJordan";

// P7 · Weekly Rep Report — Jordan · Figma 29:625 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/reports/rep/$repId")({
  component: P7WeeklyRepReportJordan,
});
