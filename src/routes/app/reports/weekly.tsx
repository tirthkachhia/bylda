import { createFileRoute } from "@tanstack/react-router";
import { P5WeeklyManagerReportLivingDocument } from "@/components/lanes/lane-4/reports/P5WeeklyManagerReportLivingDocument";

// P5 · Weekly Manager Report — living document · Figma 29:352 · Lane 6 (Mayur)
export const Route = createFileRoute("/app/reports/weekly")({
  validateSearch: (search: Record<string, unknown>): { reportId?: string } => ({
    reportId: typeof search.reportId === "string" ? search.reportId : undefined,
  }),
  component: P5WeeklyManagerReportLivingDocument,
});
