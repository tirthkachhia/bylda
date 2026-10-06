import { createFileRoute } from "@tanstack/react-router";
import { X2IntegrationsDeliveryChannels } from "@/components/lanes/lane-5/connections/X2IntegrationsDeliveryChannels";

// X2 · Integrations — Delivery channels · Figma 31:1688 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/connections/channels")({
  component: X2IntegrationsDeliveryChannels,
});
