import { createFileRoute } from "@tanstack/react-router";
import { E12MethodologyBehaviorRuleEditor } from "@/components/lanes/lane-5/settings/E12MethodologyBehaviorRuleEditor";

// E12 · Methodology — Behavior rule editor · Figma 31:8218 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/methodology/$methodologyId/rules/$ruleKey")({
  component: E12MethodologyBehaviorRuleEditor,
});
