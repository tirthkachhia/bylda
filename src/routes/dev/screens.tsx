import { createFileRoute, notFound } from "@tanstack/react-router";
import { ScreenIndex } from "@/components/bylda/dev/ScreenIndex";
import { mocksForced } from "@/lib/data";

// /dev/screens — index of all V1 screens with links. Dev builds or VITE_BYLDA_MOCKS only.
export const Route = createFileRoute("/dev/screens")({
  beforeLoad: () => {
    if (!import.meta.env.DEV && !mocksForced()) throw notFound();
  },
  component: ScreenIndex,
});
