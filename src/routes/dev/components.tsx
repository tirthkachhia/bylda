import { createFileRoute, notFound } from "@tanstack/react-router";
import { ComponentGallery } from "@/components/bylda/dev/ComponentGallery";
import { mocksForced } from "@/lib/data";

// /dev/components — every kit component in every state. Dev builds or VITE_BYLDA_MOCKS only.
export const Route = createFileRoute("/dev/components")({
  beforeLoad: () => {
    if (!import.meta.env.DEV && !mocksForced()) throw notFound();
  },
  component: ComponentGallery,
});
