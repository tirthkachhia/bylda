/** Only Figma MVP destinations. Legacy routes redirect and do not render old UI. */
export const workspaceNavigation = [
  { key: "home", label: "Home", to: "/app" },
  { key: "calls", label: "Calls", to: "/app/crm/calls" },
  { key: "people", label: "People", to: "/app/people" },
  { key: "insights", label: "Insights", to: "/app/insights" },
  { key: "coaching", label: "Coaching", to: "/app/coaching" },
  { key: "reports", label: "Reports", to: "/app/reports" },
  { key: "integrations", label: "Integrations", to: "/app/integrations" },
  { key: "settings", label: "Settings", to: "/app/settings" },
  { key: "notifications", label: "Notifications", to: "/app/notifications" },
] as const;
export const behavioralNavigation = [
  { key: "home", label: "Home", to: "/app", asset: "nav-home" },
  { key: "calls", label: "Calls", to: "/app/crm/calls", asset: "nav-calls", view: "calls" },
  { key: "people", label: "People", to: "/app/people", asset: "nav-people" },
  { key: "insights", label: "Insights", to: "/app/insights", asset: "nav-insights" },
  { key: "coaching", label: "Coaching", to: "/app/coaching", asset: "nav-coaching" },
] as const;
