import { createFileRoute } from "@tanstack/react-router";
import { E5SettingsRolesPermissions } from "@/components/lanes/lane-5/settings/E5SettingsRolesPermissions";

// E5 · Settings — Roles & permissions · Figma 31:3018 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/roles")({
  component: E5SettingsRolesPermissions,
});
