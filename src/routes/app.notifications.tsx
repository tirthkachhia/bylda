import { createFileRoute } from "@tanstack/react-router";
import { FigmaNotifications } from "@/components/app/FigmaNotifications";
export const Route = createFileRoute("/app/notifications")({ component: FigmaNotifications });
