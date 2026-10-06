import { createFileRoute } from "@tanstack/react-router";
import { P2DailyManagerBriefInAppDocument } from "@/components/lanes/lane-4/reports/P2DailyManagerBriefInAppDocument";

// P2 · Daily Manager Brief — in-app document · Figma 13:2 · Lane 6 (Mayur)
export const Route = createFileRoute("/app/reports/daily")({
  validateSearch: (search: Record<string, unknown>): { reportId?: string } => ({
    reportId: typeof search.reportId === "string" ? search.reportId : undefined,
  }),
  component: P2DailyManagerBriefInAppDocument,
});
