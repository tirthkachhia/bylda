import { createFileRoute } from "@tanstack/react-router";
import { E17SettingsAPIKeys } from "@/components/lanes/lane-5/settings/E17SettingsAPIKeys";

// E17 · Settings — API keys · Figma 31:9530 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/api-keys")({ component: E17SettingsAPIKeys });
