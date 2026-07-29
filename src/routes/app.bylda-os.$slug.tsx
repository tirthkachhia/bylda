// Legacy route — consolidated in the 7-destination IA redesign.
// Kept as a redirect so existing links, bookmarks, and AI tool chips keep working.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/bylda-os/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/app/automations", replace: true });
  },
});
