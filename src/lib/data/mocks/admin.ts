import type {
  AnalysisPreferences,
  ApiKey,
  AuditEntry,
  Invoice,
  Member,
  Methodology,
  NotificationPreferences,
  ObjectionLibraryItem,
  OnboardingState,
  Plan,
  RetentionPolicy,
  RoleDefinition,
  SuccessCriterion,
  UsageMeter,
  WorkspaceHealth,
  WorkspaceSettings,
} from "../types";
import { BEHAVIORS } from "./intelligence";
import { PEOPLE, TEAM_MM, WORKSPACE } from "./people";

/** 04 Onboarding · 05 H7 Admin Home · 16 Settings + Methodology · Billing. */
export const ONBOARDING: OnboardingState = {
  step: "analysis",
  workspaceName: WORKSPACE.name,
  methodologyTemplate: "meddic",
  connectedSources: ["zoom", "hubspot"],
  invitedCount: 9,
  analysis: { analyzed: 312, total: 486, etaMinutes: 14 },
};

export const HEALTH: WorkspaceHealth = {
  sources: [
    { key: "zoom", name: "Zoom", status: "ok" },
    { key: "aircall", name: "Aircall", status: "down" },
    { key: "hubspot", name: "HubSpot", status: "ok" },
  ],
  failedJobs: 1,
  callsAnalyzedThisWeek: 186,
  seats: { used: 14, total: 20 },
  alerts: [{ id: "al1", title: "Aircall stopped syncing on Sep 27", severity: "regress" }],
};

export const WORKSPACE_SETTINGS: WorkspaceSettings = {
  id: WORKSPACE.id,
  name: WORKSPACE.name,
  timezone: "America/New_York",
  weekStartsOn: "monday",
  defaultTeamId: TEAM_MM,
};

export const MEMBERS: Member[] = PEOPLE.slice(0, 7).map((p, i) => ({
  id: p.id,
  name: p.name,
  email: `${p.firstName.toLowerCase()}@acme-revenue.test`,
  role: p.role,
  teamId: p.teamId,
  status: i === 6 ? "invited" : "active",
}));

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "owner",
    name: "Owner",
    description: "Everything, including billing and data sources.",
    permissions: ["*"],
  },
  {
    role: "admin",
    name: "Admin",
    description: "Workspace settings, users, integrations.",
    permissions: ["settings.*", "users.*", "integrations.*"],
  },
  {
    role: "manager",
    name: "Manager",
    description: "Their teams' calls, insights and coaching.",
    permissions: ["calls.read:team", "coaching.*:team", "reports.read"],
  },
  {
    role: "coach",
    name: "Coach / QA",
    description: "Review calls and coach across teams. No rankings export.",
    permissions: ["calls.read", "coaching.*"],
  },
  {
    role: "rep",
    name: "Rep",
    description: "Only their own calls, coaching and progress. Never peer data.",
    permissions: ["calls.read:own", "coaching.read:own"],
  },
  {
    role: "viewer",
    name: "Viewer",
    description: "Read-only reports and insights.",
    permissions: ["reports.read", "insights.read"],
  },
];

export const ANALYSIS_PREFS: AnalysisPreferences = {
  minCallSeconds: 120,
  excludeInternalCalls: true,
  languages: ["en"],
  redactPii: true,
};
export const NOTIFICATION_PREFS: NotificationPreferences = {
  channel: "slack",
  types: { behavior_regression: true, report_ready: true, integration_problem: true },
  quietHours: { from: "19:00", to: "08:00" },
};
export const RETENTION: RetentionPolicy = {
  recordingsDays: 90,
  transcriptsDays: 365,
  deleteOnRequest: true,
};
export const API_KEYS: ApiKey[] = [
  {
    id: "key1",
    label: "Data warehouse export",
    last4: "9f2c",
    createdAt: "2026-08-02T00:00:00Z",
    lastUsedAt: "2026-09-29T00:00:00Z",
    scopes: ["calls.read", "insights.read"],
  },
];
export const AUDIT: AuditEntry[] = [
  {
    id: "au1",
    actorName: "Kiran Patel",
    action: "connected",
    entity: "HubSpot",
    createdAt: "2026-09-01T10:00:00Z",
  },
  {
    id: "au2",
    actorName: "Dana Whitfield",
    action: "assigned coaching",
    entity: "Jordan Reyes · Pause after objection",
    createdAt: "2026-09-29T10:00:00Z",
  },
];

export const METHODOLOGIES: Methodology[] = [
  {
    id: "meth_meddic",
    name: "MEDDIC — Mid-Market",
    template: "meddic",
    isActive: true,
    stages: ["Opening", "Discovery", "Demo", "Pricing", "Next steps"].map((name, i) => ({
      key: name.toLowerCase().replace(/\s+/g, "_"),
      name,
      order: i,
      exitCriteria: [],
    })),
    behaviors: BEHAVIORS,
  },
];

export const OBJECTION_LIBRARY: ObjectionLibraryItem[] = [
  {
    id: "ob1",
    label: "Price / budget",
    category: "Commercial",
    recommendedResponse: "Pause, ask what’s behind the number, then anchor to the rollout value.",
    seenCount: 23,
  },
  {
    id: "ob2",
    label: "Already have a tool",
    category: "Competitive",
    recommendedResponse: "Ask what they’d change about it before comparing.",
    seenCount: 6,
  },
];

export const SUCCESS_CRITERIA: SuccessCriterion[] = [
  { id: "sc1", outcome: "next_step_booked", enabled: true, source: "call" },
  { id: "sc2", outcome: "stage_advanced", enabled: true, source: "crm" },
  { id: "sc3", outcome: "closed_won_lost", enabled: true, source: "crm" },
  { id: "sc4", outcome: "meeting_held", enabled: false, source: "crm" },
];

export const PLAN: Plan = {
  tier: "Scale",
  status: "active",
  periodEnd: "2026-10-31T00:00:00Z",
  seats: 20,
  seatsUsed: 14,
  cancelAtPeriodEnd: false,
};
export const INVOICES: Invoice[] = [
  {
    id: "inv1",
    number: "ACME-0009",
    amountCents: 240000,
    currency: "usd",
    status: "paid",
    issuedAt: "2026-09-01T00:00:00Z",
    url: null,
  },
];
export const USAGE: UsageMeter[] = [
  { key: "calls_analyzed", label: "Calls analyzed", used: 486, limit: 2000, period: "Sep 2026" },
  { key: "seats", label: "Seats", used: 14, limit: 20, period: "Sep 2026" },
];
