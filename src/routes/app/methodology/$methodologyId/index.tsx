import { createFileRoute } from "@tanstack/react-router";
import { E10MethodologyDetail } from "@/components/lanes/lane-5/settings/E10MethodologyDetail";

// E10 · Methodology — Detail (stages) · Figma 31:7973 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/methodology/$methodologyId/")({
  component: E10MethodologyDetail,
});
