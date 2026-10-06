import { createFileRoute } from "@tanstack/react-router";
import { E8SettingsRetentionPrivacy } from "@/components/lanes/lane-5/settings/E8SettingsRetentionPrivacy";

// E8 · Settings — Retention & privacy · Figma 31:3738 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/retention")({
  component: E8SettingsRetentionPrivacy,
});
