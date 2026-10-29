import { createFileRoute } from "@tanstack/react-router";
import { ReportsIndex } from "@/components/app/coaching/ReportsIndex";
export const Route = createFileRoute("/app/reports")({ component: ReportsIndex });
