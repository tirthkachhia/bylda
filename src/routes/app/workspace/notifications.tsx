import { createFileRoute } from "@tanstack/react-router";
import { E7SettingsNotifications } from "@/components/lanes/lane-5/settings/E7SettingsNotifications";

// E7 · Settings — Notifications · Figma 31:3474 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/notifications")({
  component: E7SettingsNotifications,
});
