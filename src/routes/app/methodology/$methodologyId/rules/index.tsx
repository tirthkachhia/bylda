import { createFileRoute } from "@tanstack/react-router";
import { E11MethodologyBehaviorRulesList } from "@/components/lanes/lane-5/settings/E11MethodologyBehaviorRulesList";

// E11 · Methodology — Behavior rules list · Figma 31:8450 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/methodology/$methodologyId/rules/")({
  component: E11MethodologyBehaviorRulesList,
});
