import { createFileRoute } from "@tanstack/react-router";
import { E18SettingsAuditLog } from "@/components/lanes/lane-5/settings/E18SettingsAuditLog";

// E18 · Settings — Audit log · Figma 31:9715 · Lane 5 (Mayur)
export const Route = createFileRoute("/app/workspace/audit-log")({
  component: E18SettingsAuditLog,
});
