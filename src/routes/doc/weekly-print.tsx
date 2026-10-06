import { createFileRoute } from "@tanstack/react-router";
import { P10WeeklyReportPDFPrint } from "@/components/lanes/lane-4/reports/P10WeeklyReportPDFPrint";

// P10 · Weekly Report — PDF / print (A4) · Figma 29:1154 · Lane 4 (Dravin)
export const Route = createFileRoute("/doc/weekly-print")({ component: P10WeeklyReportPDFPrint });
