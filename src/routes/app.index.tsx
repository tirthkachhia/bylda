import { createFileRoute } from "@tanstack/react-router";
import { TodayBrief } from "@/components/app/TodayBrief";

export const Route = createFileRoute("/app/")({
  component: TodayBrief,
});
