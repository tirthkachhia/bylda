// Bylda's front door — the product home for the operating layer.
// Kept as a redirect so existing links, bookmarks, and AI tool chips keep working.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/bylda/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/bylda-home", replace: true });
  },
});
