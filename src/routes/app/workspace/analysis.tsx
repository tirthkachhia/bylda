import { createFileRoute } from "@tanstack/react-router";
import { E6SettingsAnalysisPreferences } from "@/components/lanes/lane-5/settings/E6SettingsAnalysisPreferences";

// E6 · Settings — Analysis preferences · Figma 31:3275 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/analysis")({
  component: E6SettingsAnalysisPreferences,
});
