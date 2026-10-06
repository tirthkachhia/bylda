import { createFileRoute } from "@tanstack/react-router";
import { X3IntegrationDetailHubSpotMapping } from "@/components/lanes/lane-5/connections/X3IntegrationDetailHubSpotMapping";

// X3 · Integration detail — HubSpot mapping · Figma 31:1915 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/connections/hubspot")({
  component: X3IntegrationDetailHubSpotMapping,
});
