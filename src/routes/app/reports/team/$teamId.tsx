import { createFileRoute } from "@tanstack/react-router";
import { P8TeamReportSeptember } from "@/components/lanes/lane-4/reports/P8TeamReportSeptember";

// P8 · Team Report — September · Figma 29:773 · Lane 4 (Dravin)
export const Route = createFileRoute("/app/reports/team/$teamId")({
  component: P8TeamReportSeptember,
});
