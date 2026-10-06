import { createFileRoute } from "@tanstack/react-router";
import { E15SettingsBillingPlan } from "@/components/lanes/lane-5/settings/E15SettingsBillingPlan";

// E15 · Settings — Billing & plan · Figma 31:9113 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/billing")({
  component: E15SettingsBillingPlan,
});
