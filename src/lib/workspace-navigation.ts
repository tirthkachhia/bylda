import type { IconName } from "@/components/bylda/kit/Icon";
// V1 presentation, original live destinations. Unsupported mock screens are not exposed.
export const workspaceNavigation: { key: string; label: string; to: string; icon: IconName }[] = [
  { key: "home", label: "Home", to: "/app", icon: "home" },
  { key: "calls", label: "Calls & coaching", to: "/app/crm/calls", icon: "calls" },
  { key: "memory", label: "Deal intelligence", to: "/app/memory", icon: "intelligence" },
  { key: "contacts", label: "Accounts", to: "/app/contacts", icon: "team" },
  { key: "reports", label: "Reports", to: "/app/bylda/reports", icon: "reports" },
  { key: "integrations", label: "Integrations", to: "/app/integrations", icon: "plug" },
  { key: "setup", label: "CRM intelligence", to: "/app/crm/setup", icon: "pattern" },
];
