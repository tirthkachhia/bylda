import {
  mapObjectionStat,
  mapPattern,
  type ObjectionStatRow,
  type PatternRow,
} from "../behaviors/map";
import { fetchPatterns } from "../behaviors/fetchers";
import { mapSavedView, type SavedViewRow } from "../calls/map";
import { fetchSavedViews } from "../calls/fetchers";
import { NotBuiltError } from "../core/errors";
import { mapWorkspaceHealth, type WorkspaceHealthRow } from "../insights/map";
import {
  mapDeliveryChannel,
  mapFieldMapping,
  mapIntegrationSource,
  type DeliveryChannelRow,
  type FieldMappingRow,
  type IntegrationSourceRow,
} from "../integrations/map";
import { fetchDeliveryChannels, fetchFieldMappings } from "../integrations/fetchers";
import {
  mapMethodology,
  mapObjectionLibrary,
  mapSuccessCriterion,
  type MethodologyRow,
  type ObjectionLibraryRow,
  type SuccessCriterionRow,
} from "../methodology/map";
import { fetchMethodologies } from "../methodology/fetchers";
import {
  mapNotificationV1,
  mapPushSubscription,
  type NotificationV1Row,
  type PushSubscriptionRow,
} from "../notifications/map";
import { mapAnalysisProgress, type AnalysisProgressRow } from "../onboarding/map";
import { fetchAnalysisProgress } from "../onboarding/fetchers";
import { mapOutcomeAssociation, type OutcomeAssociationRow } from "../outcomes/map";
import { fetchOutcomeAssociations } from "../outcomes/fetchers";
import {
  mapDmThread,
  mapMessage,
  mapRoom,
  type DmThreadRow,
  type MessageRow,
  type RoomRow,
} from "../rooms/map";
import { fetchMessages, fetchRooms } from "../rooms/fetchers";
import { mapSearchResponse, type SearchResponseRow } from "../search/map";
import { postSearchCalls } from "../search/fetchers";
import {
  mapAnalysisPrefs,
  mapApiKey,
  mapNotificationPrefs,
  type ApiKeyRow,
  type NotificationPrefsRow,
  type SettingsRow,
} from "../settings/map";
import { fetchWorkspaceSettingsRow } from "../settings/fetchers";
import { mapRepComparison, type RepComparisonRow } from "../team/map";
import { fetchRepComparison } from "../team/fetchers";
import { mapSubscriptionV1, type SubscriptionV1Row } from "../billing/map";
import {
  DATA_SOURCES,
  DELIVERY_CHANNELS,
  DM_THREADS,
  HUBSPOT_MAPPINGS,
  MESSAGES,
  NOTIFICATIONS,
  ROOMS,
} from "../mocks/collab";
import { OBJECTIONS, OUTCOMES, PATTERNS } from "../mocks/intelligence";
import {
  ANALYSIS_PREFS,
  API_KEYS,
  HEALTH,
  METHODOLOGIES,
  NOTIFICATION_PREFS,
  OBJECTION_LIBRARY,
  ONBOARDING,
  PLAN,
  SUCCESS_CRITERIA,
} from "../mocks/admin";
import { SAVED_VIEWS } from "../mocks/calls";
import { RLS_ORG, defineContract } from "./types";

const notBuilt = (what: string) => async (): Promise<never> => {
  throw new NotBuiltError(what);
};

// C-14 ─ Flow 3 · Pattern / Flow 9 · Intelligence ─────────────────────────────
export const C14 = defineContract<OutcomeAssociationRow, ReturnType<typeof mapOutcomeAssociation>>({
  id: "C-14",
  order: 14,
  title: "OutcomeAssociation — behavior × outcome (association only)",
  flows: ["Flow 3 · Pattern", "Flow 9 · Intelligence"],
  screens: ["I2", "I5", "I6", "I9"],
  gaps: [
    "08 Behavior × Outcome matrix",
    "08 Behavioral Outcome Graph",
    "08 outcome patterns",
    "n<30 suppression (Y3)",
  ],
  viewModel: { type: "OutcomeAssociation", file: "types/outcome.ts" },
  domain: "outcomes",
  table: {
    name: "outcome_associations",
    change: "new",
    columns: [
      { name: "organization_id", type: "uuid" },
      { name: "team_id", type: "uuid", nullable: true },
      { name: "behavior_key", type: "text" },
      { name: "behavior_name", type: "text" },
      { name: "outcome", type: { enum: ["won", "lost", "advanced", "next_step_booked"] } },
      { name: "with_rate", type: "numeric" },
      { name: "without_rate", type: "numeric" },
      { name: "n_with", type: "int" },
      { name: "n_without", type: "int" },
      { name: "n_closed", type: "int", note: "the UI hides the association below 30" },
      { name: "confidence", type: { enum: ["low", "medium", "high"] } },
      { name: "confounders", type: "text[]" },
      { name: "computed_at", type: "timestamptz" },
    ],
    rls: RLS_ORG + "; never a rep",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/outcome_associations?behavior_key=eq.{key}",
      input: "behavior_key?",
      output: "OutcomeAssociationRow[]",
      auth: "JWT + RLS, non-rep",
    },
  ],
  status: "Not started",
  example: {
    organization_id: "org_acme",
    team_id: "team_mm",
    behavior_key: "discovery_depth",
    behavior_name: "Discovery depth",
    outcome: "won",
    with_rate: 0.41,
    without_rate: 0.18,
    n_with: 22,
    n_without: 19,
    n_closed: 41,
    confidence: "medium",
    confounders: ["deal size"],
    computed_at: "2026-09-29T00:00:00Z",
  },
  map: mapOutcomeAssociation,
  mock: () => OUTCOMES[0],
  fetchReal: () => fetchOutcomeAssociations(),
});

export const C15 = defineContract<PatternRow, ReturnType<typeof mapPattern>>({
  id: "C-15",
  order: 15,
  title: "Patterns — emerging team / rep / prospect / outcome / methodology patterns",
  flows: ["Flow 3 · Pattern", "Flow 9 · Intelligence"],
  screens: ["I1", "I3", "I7", "I8", "I9", "I10", "I11", "O3"],
  gaps: ["08 Emerging Patterns", "08 the five Intelligence tabs"],
  viewModel: { type: "Pattern", file: "types/behavior.ts" },
  domain: "behaviors",
  table: {
    name: "patterns",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "scope", type: { enum: ["team", "rep", "prospect", "outcome", "methodology"] } },
      { name: "headline", type: "text" },
      { name: "confidence", type: { enum: ["low", "medium", "high"] } },
      { name: "sample_size", type: "int", note: "patterns start at ~50 calls per team" },
      { name: "first_seen_at", type: "date" },
      { name: "behavior_key", type: "text", nullable: true },
      { name: "affected_rep_ids", type: "uuid[]" },
    ],
    rls: RLS_ORG + "; never a rep",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/patterns?scope=eq.{scope}",
      input: "scope?",
      output: "PatternRow[]",
      auth: "JWT + RLS, non-rep",
    },
  ],
  status: "Not started",
  example: {
    id: "pat_1",
    organization_id: "org_acme",
    scope: "team",
    headline: "Reps answered before diagnosing in 7 of 9 price objections.",
    confidence: "medium",
    sample_size: 9,
    first_seen_at: "2026-09-26",
    behavior_key: "pause_after_objection",
    affected_rep_ids: ["u_jordan"],
  },
  map: mapPattern,
  // The table has no status / rule / selected yet (F-1), so the contract's mock is a pattern as the
  // table can deliver it today. The optional view-model fields stay on the fixtures.
  mock: () => {
    const { status: _s, rule: _r, selected: _p, ...row } = PATTERNS[0];
    return row;
  },
  fetchReal: () => fetchPatterns(),
});

// C-16 ─ Flow 4 · Sign up & connect ───────────────────────────────────────────
export const C16 = defineContract<AnalysisProgressRow, ReturnType<typeof mapAnalysisProgress>>({
  id: "C-16",
  order: 16,
  title: "Workspace analysis progress",
  flows: ["Flow 4 · Sign up & connect"],
  screens: ["A10", "A11", "Y2 (Home · Analysis processing)"],
  gaps: ["04 analysis-initializing progress % (call_analysis_jobs is per-call)"],
  viewModel: { type: "OnboardingState['analysis']", file: "types/workspace.ts" },
  domain: "onboarding",
  table: {
    name: "get_workspace_analysis_progress",
    change: "view",
    columns: [
      { name: "workspace_id", type: "uuid" },
      { name: "analyzed", type: "int", note: "count(call_analysis_jobs completed)" },
      { name: "total", type: "int", note: "count(calls)" },
      { name: "eta_minutes", type: "int", nullable: true },
      { name: "first_insight_ready", type: "bool" },
    ],
    rls: "RPC, security invoker",
  },
  endpoints: [
    {
      kind: "rpc",
      name: "get_workspace_analysis_progress()",
      input: "—",
      output: "AnalysisProgressRow",
      auth: "JWT",
    },
  ],
  status: "Not started",
  example: {
    workspace_id: "ws_acme",
    analyzed: 312,
    total: 486,
    eta_minutes: 14,
    first_insight_ready: false,
  },
  map: mapAnalysisProgress,
  mock: () => ONBOARDING.analysis,
  fetchReal: async () => [await fetchAnalysisProgress()],
});

export const C17 = defineContract<MethodologyRow, ReturnType<typeof mapMethodology>>({
  id: "C-17",
  order: 17,
  title: "Methodology — template, stages, behavior rules",
  flows: ["Flow 4 · Sign up & connect", "Flow 12 · Settings"],
  screens: ["A7", "E9", "E10", "E11", "E12", "I8"],
  gaps: [
    "04 'teach Bylda how you sell' — stage definitions",
    "16 methodology index / stages / rules / rule editor",
  ],
  viewModel: { type: "Methodology", file: "types/settings.ts" },
  domain: "methodology",
  table: {
    name: "methodologies",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "name", type: "text" },
      {
        name: "template",
        type: { enum: ["meddic", "spin", "challenger", "sandler", "bant", "custom"] },
      },
      { name: "is_active", type: "bool" },
      {
        name: "stages",
        type: "jsonb",
        note: "[{ key, name, order, exit_criteria[] }] — or a methodology_stages table",
      },
      {
        name: "behaviors",
        type: "jsonb",
        note: "view: behaviors (C-02) where methodology_id = id",
      },
    ],
    rls: RLS_ORG + "; writes: admin/owner",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/v_methodologies",
      input: "—",
      output: "MethodologyRow[]",
      auth: "JWT + RLS",
    },
    {
      kind: "edge",
      name: "apply-methodology-template",
      input: "{ template }",
      output: "MethodologyRow",
      auth: "JWT, admin (onboarding A7)",
    },
  ],
  status: "Not started",
  example: {
    id: "meth_meddic",
    organization_id: "org_acme",
    name: "MEDDIC — Mid-Market",
    template: "meddic",
    is_active: true,
    stages: [{ key: "discovery", name: "Discovery", order: 1, exit_criteria: [] }],
    behaviors: [],
  },
  map: mapMethodology,
  mock: () => METHODOLOGIES[0],
  fetchReal: () => fetchMethodologies(),
});

export const C18 = defineContract<ObjectionLibraryRow, ReturnType<typeof mapObjectionLibrary>>({
  id: "C-18",
  order: 18,
  title: "Objection library",
  flows: ["Flow 4 · Sign up & connect", "Flow 12 · Settings"],
  screens: ["E13", "A7"],
  gaps: ["16 objection library"],
  viewModel: { type: "ObjectionLibraryItem", file: "types/settings.ts" },
  domain: "methodology",
  table: {
    name: "objection_library",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "label", type: "text" },
      { name: "category", type: "text" },
      { name: "recommended_response", type: "text" },
      {
        name: "seen_count",
        type: "int",
        note: "view column over behavioral_events type=objection",
      },
    ],
    rls: RLS_ORG + "; writes: admin/owner",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · POST /rest/v1/objection_library",
      input: "{ label, category, recommended_response }",
      output: "ObjectionLibraryRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "ob1",
    organization_id: "org_acme",
    label: "Price / budget",
    category: "Commercial",
    recommended_response: "Pause, ask what's behind the number.",
    seen_count: 23,
  },
  map: mapObjectionLibrary,
  mock: () => OBJECTION_LIBRARY[0],
  fetchReal: notBuilt("objection_library"),
});

export const C19 = defineContract<SuccessCriterionRow, ReturnType<typeof mapSuccessCriterion>>({
  id: "C-19",
  order: 19,
  title: "Success criteria — which outcomes Bylda learns from",
  flows: ["Flow 4 · Sign up & connect", "Flow 12 · Settings"],
  screens: ["E14", "A7"],
  gaps: ["16 success criteria (expected_outcomes is CRM-shaped)"],
  viewModel: { type: "SuccessCriterion", file: "types/settings.ts" },
  domain: "methodology",
  table: {
    name: "success_criteria",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      {
        name: "outcome",
        type: { enum: ["next_step_booked", "stage_advanced", "closed_won_lost", "meeting_held"] },
      },
      { name: "enabled", type: "bool" },
      { name: "source", type: { enum: ["call", "crm"] } },
    ],
    rls: RLS_ORG + "; writes: admin/owner",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · PATCH /rest/v1/success_criteria",
      input: "{ enabled }",
      output: "SuccessCriterionRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "sc1",
    organization_id: "org_acme",
    outcome: "next_step_booked",
    enabled: true,
    source: "call",
  },
  map: mapSuccessCriterion,
  mock: () => SUCCESS_CRITERIA[0],
  fetchReal: notBuilt("success_criteria"),
});

export const C20 = defineContract<IntegrationSourceRow, ReturnType<typeof mapIntegrationSource>>({
  id: "C-20",
  order: 20,
  title: "Data source sync stats — calls synced, waiting backlog, category",
  flows: ["Flow 4 · Sign up & connect", "Flow 11 · Connections"],
  screens: ["X1", "A8", "H7", "Y8"],
  gaps: ["15 calls synced / waiting per source", "Y8 'N calls waiting will backfill'"],
  viewModel: { type: "DataSource", file: "types/integration.ts" },
  domain: "integrations",
  table: {
    name: "v_integration_sources",
    change: "view",
    columns: [
      { name: "integration_key", type: "text" },
      { name: "name", type: "text" },
      { name: "category", type: { enum: ["recorder", "dialer", "crm", "meetings"] } },
      { name: "status", type: { enum: ["connected", "disconnected", "error", "not_connected"] } },
      { name: "last_sync_at", type: "timestamptz", nullable: true },
      { name: "calls_synced", type: "int" },
      { name: "waiting", type: "int" },
      { name: "last_error", type: "text", nullable: true },
    ],
    rls: "security_invoker over user_integrations_masked + integration_raw_objects counts",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/v_integration_sources",
      input: "—",
      output: "IntegrationSourceRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    integration_key: "aircall",
    name: "Aircall",
    category: "dialer",
    status: "error",
    last_sync_at: "2026-09-27T12:00:00Z",
    calls_synced: 74,
    waiting: 23,
    last_error: "The access token expired.",
  },
  map: mapIntegrationSource,
  mock: () => DATA_SOURCES[1],
  fetchReal: notBuilt("v_integration_sources"),
});

export const C21 = defineContract<DeliveryChannelRow, ReturnType<typeof mapDeliveryChannel>>({
  id: "C-21",
  order: 21,
  title: "Delivery channels — Slack · Teams · email · push, separate from sources",
  flows: ["Flow 11 · Connections", "Flow 12 · Settings"],
  screens: ["X2", "E7"],
  gaps: [
    "14 Slack/Teams delivery config",
    "15 delivery channels as a separate area (V1 decision 5)",
  ],
  viewModel: { type: "DeliveryChannel", file: "types/integration.ts" },
  domain: "integrations",
  table: {
    name: "delivery_channels",
    change: "new",
    columns: [
      { name: "organization_id", type: "uuid" },
      { name: "key", type: { enum: ["slack", "teams", "email", "push"] } },
      { name: "name", type: "text" },
      { name: "status", type: { enum: ["connected", "not_connected"] } },
      { name: "destinations", type: "text[]", note: "channels / addresses" },
    ],
    rls: RLS_ORG + "; writes: admin/owner. Disconnecting a channel never stops analysis.",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · PATCH /rest/v1/delivery_channels",
      input: "{ destinations }",
      output: "DeliveryChannelRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    organization_id: "org_acme",
    key: "slack",
    name: "Slack",
    status: "connected",
    destinations: ["#sales-leadership"],
  },
  map: mapDeliveryChannel,
  mock: () => DELIVERY_CHANNELS[0],
  fetchReal: () => fetchDeliveryChannels(),
});

export const C22 = defineContract<FieldMappingRow, ReturnType<typeof mapFieldMapping>>({
  id: "C-22",
  order: 22,
  title: "CRM field mapping (read-only)",
  flows: ["Flow 4 · Sign up & connect", "Flow 11 · Connections"],
  screens: ["X3", "A8"],
  gaps: ["15 HubSpot field-mapping UI state"],
  viewModel: { type: "FieldMapping", file: "types/integration.ts" },
  domain: "integrations",
  table: {
    name: "integration_field_mappings",
    change: "new",
    columns: [
      { name: "organization_id", type: "uuid" },
      { name: "integration_key", type: "text" },
      { name: "bylda_field", type: "text" },
      { name: "crm_object", type: "text" },
      { name: "crm_field", type: "text", nullable: true },
      { name: "required", type: "bool" },
    ],
    rls:
      RLS_ORG +
      "; writes: admin/owner. Direction is always READ in V1 — Bylda never writes to the CRM.",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · PATCH /rest/v1/integration_field_mappings?integration_key=eq.{key}",
      input: "{ crm_field }",
      output: "FieldMappingRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    organization_id: "org_acme",
    integration_key: "hubspot",
    bylda_field: "Stage at call",
    crm_object: "Deal",
    crm_field: "dealstage",
    required: true,
  },
  map: mapFieldMapping,
  mock: () => HUBSPOT_MAPPINGS[0],
  fetchReal: () => fetchFieldMappings("hubspot"),
});

// C-23 ─ Flow 8 · Ask & find ─────────────────────────────────────────────────
export const C23 = defineContract<SearchResponseRow, ReturnType<typeof mapSearchResponse>>({
  id: "C-23",
  order: 23,
  title: "Search — question → visible filters → calls (never answers from memory)",
  flows: ["Flow 8 · Ask & find"],
  screens: ["S1", "S2", "S3", "B9", "Y12"],
  gaps: [
    "13 call / behavior / pattern / coaching entities in the palette",
    "13 NL query over behavior data",
  ],
  viewModel: { type: "SearchResponse", file: "types/search.ts" },
  domain: "search",
  table: {
    name: "search-calls",
    change: "view",
    columns: [
      { name: "query", type: "text" },
      { name: "window_days", type: "int" },
      {
        name: "filters",
        type: "jsonb",
        note: "[{ field, value, label }] — shown as editable chips",
      },
      {
        name: "results",
        type: "jsonb",
        note: "[{ call_id, title, rep_name, started_at, snippet, t_seconds, matched[] }]",
      },
    ],
    rls: "edge fn with the caller's JWT; reps get only their own calls",
  },
  endpoints: [
    {
      kind: "edge",
      name: "search-calls",
      input: "{ query, window_days }",
      output: "SearchResponseRow",
      auth: "JWT",
    },
    {
      kind: "rpc",
      name: "search_entities(q)",
      input: "{ q }",
      output: "PaletteItem[]",
      auth: "JWT; reps: no people/patterns",
    },
  ],
  status: "Not started",
  example: {
    query: "price objections Jordan",
    window_days: 30,
    filters: [{ field: "rep", value: "u_jordan", label: "Jordan Reyes" }],
    results: [
      {
        call_id: "call_acme",
        title: "Jordan × Acme Logistics",
        rep_name: "Jordan Reyes",
        started_at: "2026-09-28T14:00:00Z",
        snippet: "Lost control 18:42",
        t_seconds: 1122,
        matched: ["rep"],
      },
    ],
  },
  map: mapSearchResponse,
  mock: () => ({
    query: "price objections Jordan",
    windowDays: 30,
    filters: [{ field: "rep" as const, value: "u_jordan", label: "Jordan Reyes" }],
    results: [
      {
        callId: "call_acme",
        title: "Jordan × Acme Logistics",
        repName: "Jordan Reyes",
        startedAt: "2026-09-28T14:00:00Z",
        snippet: "Lost control 18:42",
        timestamp: "18:42",
        matched: ["rep" as const],
      },
    ],
  }),
  fetchReal: async () => [await postSearchCalls({ query: "", window_days: 30 })],
});

export const C24 = defineContract<NotificationV1Row, ReturnType<typeof mapNotificationV1>>({
  id: "C-24",
  order: 24,
  title: "Notifications — V1 types, severity, title/body, link",
  flows: ["Flow 8 · Ask & find"],
  screens: ["N1", "N2", "B5", "shell bell dot"],
  gaps: ["14 behavioral notification types", "severity is a dot and a word"],
  viewModel: { type: "Notification", file: "types/notification.ts" },
  domain: "notifications",
  table: {
    name: "notifications",
    change: "alter",
    columns: [
      { name: "id", type: "uuid" },
      { name: "user_id", type: "uuid" },
      { name: "organization_id", type: "uuid", note: "NEW" },
      {
        name: "type",
        type: {
          enum: [
            "behavior_regression",
            "important_call",
            "emerging_pattern",
            "report_ready",
            "coaching_completed",
            "coaching_acknowledged",
            "methodology_breakdown",
            "integration_problem",
            "behavior_improvement",
          ],
        },
        note: "constrain today's free-text type",
      },
      {
        name: "severity",
        type: { enum: ["info", "attention", "regress", "improve"] },
        note: "NEW",
      },
      { name: "title", type: "text", note: "NEW (today: message)" },
      { name: "body", type: "text", nullable: true, note: "NEW" },
      { name: "href", type: "text", note: "NEW — in-app link" },
      { name: "read", type: "bool" },
      { name: "created_at", type: "timestamptz" },
    ],
    rls: "user_id = auth.uid()",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · PATCH /rest/v1/notifications?user_id=eq.{uid}",
      input: "{ read }",
      output: "NotificationV1Row[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "n1",
    user_id: "u_dana",
    organization_id: "org_acme",
    type: "behavior_regression",
    severity: "regress",
    title: "Jordan's pause dropped to 0.4s",
    body: "4 of 6 price objections this week.",
    href: "/app/intelligence/behaviors/pause_after_objection",
    read: false,
    created_at: "2026-09-30T08:04:00Z",
  },
  map: mapNotificationV1,
  mock: () => NOTIFICATIONS[0],
  fetchReal: notBuilt("notifications.v1_columns"),
});

// C-25 ─ Flow 9 · Intelligence ─────────────────────────────────────────────────
export const C25 = defineContract<ObjectionStatRow, ReturnType<typeof mapObjectionStat>>({
  id: "C-25",
  order: 25,
  title: "Objection stats — handled-well rate + weekly trend",
  flows: ["Flow 9 · Intelligence"],
  screens: ["I4", "O3"],
  gaps: ["08 objection view: handled well / trend (frequency is buildable today)"],
  viewModel: { type: "ObjectionStat", file: "types/behavior.ts" },
  domain: "behaviors",
  table: {
    name: "get_objection_stats",
    change: "view",
    columns: [
      { name: "label", type: "text" },
      { name: "count", type: "int" },
      { name: "call_count", type: "int" },
      {
        name: "handled_well_rate",
        type: "numeric",
        nullable: true,
        note: "needs behavioral_events (C-01)",
      },
      { name: "trend", type: { enum: ["improving", "regressing", "steady"] } },
      { name: "sample_size", type: "int" },
      { name: "confidence", type: { enum: ["low", "medium", "high"] } },
    ],
    rls: "RPC; non-rep",
  },
  endpoints: [
    {
      kind: "rpc",
      name: "get_objection_stats(p_days)",
      input: "{ days }",
      output: "ObjectionStatRow[]",
      auth: "JWT, non-rep",
    },
  ],
  status: "Not started",
  example: {
    label: "Price / budget",
    count: 23,
    call_count: 17,
    handled_well_rate: 0.35,
    trend: "regressing",
    sample_size: 23,
    confidence: "high",
  },
  map: mapObjectionStat,
  mock: () => OBJECTIONS[0],
  fetchReal: notBuilt("get_objection_stats"),
});

// C-26 ─ Flow 10 · Team ─────────────────────────────────────────────────────────
export const C26 = defineContract<
  RepComparisonRow,
  ReturnType<typeof mapRepComparison>["rows"][number]
>({
  id: "C-26",
  order: 26,
  title: "Rep comparison — MANAGER-ONLY",
  flows: ["Flow 10 · Team"],
  screens: ["T13"],
  gaps: ["09 rep comparison on behavior"],
  viewModel: { type: "RepComparisonRow", file: "types/people.ts" },
  domain: "team",
  table: {
    name: "get_rep_comparison",
    change: "view",
    columns: [
      { name: "behavior_key", type: "text" },
      { name: "behavior_name", type: "text" },
      { name: "team_median", type: "numeric" },
      { name: "values", type: "jsonb", note: "[{ rep_id, value, n }]" },
    ],
    rls: "RPC, security definer; RAISE if the caller's role is rep",
  },
  endpoints: [
    {
      kind: "rpc",
      name: "get_rep_comparison(p_team_id)",
      input: "{ team_id }",
      output: "RepComparisonRow[]",
      auth: "JWT, manager/coach/admin/owner/viewer",
    },
  ],
  status: "Not started",
  example: {
    behavior_key: "pause_after_objection",
    behavior_name: "Pause after objection",
    team_median: 1.0,
    values: [{ rep_id: "u_jordan", value: 0.4, n: 38 }],
  },
  map: (r) => mapRepComparison([r]).rows[0],
  mock: () => ({
    behaviorKey: "pause_after_objection",
    name: "Pause after objection",
    teamMedian: 1.0,
    values: [{ repId: "u_jordan", value: 0.4, n: 38 }],
  }),
  fetchReal: () => fetchRepComparison("team_mm"),
});

// C-27 … C-32 ─ Flow 12 · Settings ─────────────────────────────────────────────
export const C27 = defineContract<SettingsRow, ReturnType<typeof mapAnalysisPrefs>>({
  id: "C-27",
  order: 27,
  title: "Workspace settings — timezone, analysis preferences, retention",
  flows: ["Flow 12 · Settings"],
  screens: ["E1", "E6", "E8", "Y11"],
  gaps: ["16 analysis preferences", "16 retention & privacy settings"],
  viewModel: { type: "AnalysisPreferences", file: "types/settings.ts" },
  domain: "settings",
  table: {
    name: "workspace_settings",
    change: "new",
    columns: [
      { name: "workspace_id", type: "uuid" },
      { name: "timezone", type: "text" },
      { name: "week_starts_on", type: { enum: ["monday", "sunday"] } },
      { name: "min_call_seconds", type: "int" },
      { name: "exclude_internal_calls", type: "bool" },
      { name: "languages", type: "text[]" },
      { name: "redact_pii", type: "bool" },
      { name: "recordings_retention_days", type: "int" },
      { name: "transcripts_retention_days", type: "int" },
      { name: "delete_on_request", type: "bool" },
    ],
    rls: "org members read; admin/owner write",
    notes: "Also maps to RetentionPolicy (mapRetention).",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · PATCH /rest/v1/workspace_settings?workspace_id=eq.{id}",
      input: "partial row",
      output: "SettingsRow",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    workspace_id: "ws_acme",
    timezone: "America/New_York",
    week_starts_on: "monday",
    min_call_seconds: 120,
    exclude_internal_calls: true,
    languages: ["en"],
    redact_pii: true,
    recordings_retention_days: 90,
    transcripts_retention_days: 365,
    delete_on_request: true,
  },
  map: mapAnalysisPrefs,
  mock: () => ANALYSIS_PREFS,
  fetchReal: async () => [await fetchWorkspaceSettingsRow()],
});

export const C28 = defineContract<NotificationPrefsRow, ReturnType<typeof mapNotificationPrefs>>({
  id: "C-28",
  order: 28,
  title: "Notification preferences (per user)",
  flows: ["Flow 12 · Settings"],
  screens: ["E7"],
  gaps: ["16 notifications settings"],
  viewModel: { type: "NotificationPreferences", file: "types/settings.ts" },
  domain: "settings",
  table: {
    name: "notification_preferences",
    change: "new",
    columns: [
      { name: "user_id", type: "uuid" },
      { name: "channel", type: { enum: ["in_app", "email", "slack"] } },
      { name: "types", type: "jsonb", note: "{ [NotificationType]: boolean }" },
      { name: "quiet_from", type: "text", nullable: true, note: "'19:00'" },
      { name: "quiet_to", type: "text", nullable: true },
    ],
    rls: "user_id = auth.uid()",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · PATCH /rest/v1/notification_preferences",
      input: "partial row",
      output: "NotificationPrefsRow",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    user_id: "u_dana",
    channel: "slack",
    types: { behavior_regression: true, report_ready: true, integration_problem: true },
    quiet_from: "19:00",
    quiet_to: "08:00",
  },
  map: mapNotificationPrefs,
  mock: () => NOTIFICATION_PREFS,
  fetchReal: notBuilt("notification_preferences"),
});

export const C29 = defineContract<ApiKeyRow, ReturnType<typeof mapApiKey>>({
  id: "C-29",
  order: 29,
  title: "API keys",
  flows: ["Flow 12 · Settings"],
  screens: ["E17"],
  gaps: ["16 API keys"],
  viewModel: { type: "ApiKey", file: "types/settings.ts" },
  domain: "settings",
  table: {
    name: "api_keys",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "label", type: "text" },
      { name: "last4", type: "text", note: "hash stored server-side; secret shown once" },
      { name: "scopes", type: "text[]" },
      { name: "created_at", type: "timestamptz" },
      { name: "last_used_at", type: "timestamptz", nullable: true },
    ],
    rls: "admin/owner only",
  },
  endpoints: [
    {
      kind: "edge",
      name: "create-api-key",
      input: "{ label, scopes }",
      output: "{ key (once), row: ApiKeyRow }",
      auth: "JWT, admin/owner",
    },
    {
      kind: "postgrest",
      name: "GET · DELETE /rest/v1/api_keys",
      input: "id",
      output: "ApiKeyRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "key1",
    organization_id: "org_acme",
    label: "Data warehouse export",
    last4: "9f2c",
    scopes: ["calls.read"],
    created_at: "2026-08-02T00:00:00Z",
    last_used_at: null,
  },
  map: mapApiKey,
  mock: () => API_KEYS[0],
  fetchReal: notBuilt("api_keys"),
});

export const C30 = defineContract<SavedViewRow, ReturnType<typeof mapSavedView>>({
  id: "C-30",
  order: 30,
  title: "Saved call views",
  flows: ["Flow 1 · Manager day (C1 entry)"],
  screens: ["C1"],
  gaps: ["07 saved views / filters (client-side fallback today)"],
  viewModel: { type: "SavedView", file: "types/call.ts" },
  domain: "calls",
  table: {
    name: "saved_views",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "user_id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "filter", type: "jsonb", note: "CallFilter" },
      { name: "call_count", type: "int", note: "view column" },
      { name: "created_at", type: "timestamptz" },
    ],
    rls: "user_id = auth.uid() (personal) or shared to the team",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · POST /rest/v1/saved_views",
      input: "{ name, filter }",
      output: "SavedViewRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "sv1",
    organization_id: "org_acme",
    user_id: "u_dana",
    name: "Worth your time",
    filter: { teamId: "team_mm" },
    call_count: 3,
    created_at: "2026-09-01T00:00:00Z",
  },
  map: mapSavedView,
  mock: () => SAVED_VIEWS[0],
  fetchReal: () => fetchSavedViews(),
});

export const C31 = defineContract<WorkspaceHealthRow, ReturnType<typeof mapWorkspaceHealth>>({
  id: "C-31",
  order: 31,
  title: "Workspace health (owner home)",
  flows: ["Flow 0 · Sign in (owner lands on H7)"],
  screens: ["H7"],
  gaps: [
    "05 admin: org-scoped failed jobs, seats, weekly analyzed (health_checks is global today)",
  ],
  viewModel: { type: "WorkspaceHealth", file: "types/workspace.ts" },
  domain: "insights",
  table: {
    name: "get_workspace_health",
    change: "view",
    columns: [
      { name: "sources", type: "jsonb", note: "[{ key, name, status: ok|degraded|down }]" },
      { name: "failed_jobs", type: "int" },
      { name: "calls_analyzed_this_week", type: "int" },
      { name: "seats_used", type: "int" },
      { name: "seats_total", type: "int", nullable: true },
      { name: "alerts", type: "jsonb", note: "[{ id, title, severity }]" },
    ],
    rls: "RPC; admin/owner",
  },
  endpoints: [
    {
      kind: "rpc",
      name: "get_workspace_health()",
      input: "—",
      output: "WorkspaceHealthRow",
      auth: "JWT, admin/owner",
    },
  ],
  status: "Not started",
  example: {
    sources: [{ key: "zoom", name: "Zoom", status: "ok" }],
    failed_jobs: 1,
    calls_analyzed_this_week: 186,
    seats_used: 14,
    seats_total: 20,
    alerts: [{ id: "al1", title: "Aircall stopped syncing on Sep 27", severity: "regress" }],
  },
  map: mapWorkspaceHealth,
  mock: () => HEALTH,
  fetchReal: notBuilt("get_workspace_health"),
});

export const C32 = defineContract<SubscriptionV1Row, ReturnType<typeof mapSubscriptionV1>>({
  id: "C-32",
  order: 32,
  title: "Seats on the subscription",
  flows: ["Flow 12 · Settings"],
  screens: ["E15", "E16", "H7"],
  gaps: ["16 billing: seats / seats used"],
  viewModel: { type: "Plan", file: "types/billing.ts" },
  domain: "billing",
  table: {
    name: "subscriptions",
    change: "alter",
    columns: [
      { name: "organization_id", type: "uuid" },
      { name: "plan", type: "text" },
      {
        name: "status",
        type: { enum: ["trialing", "active", "past_due", "canceled", "incomplete"] },
      },
      { name: "current_period_end", type: "timestamptz", nullable: true },
      { name: "cancel_at_period_end", type: "bool" },
      { name: "seats", type: "int", nullable: true, note: "NEW — from Stripe quantity" },
      { name: "seats_used", type: "int", note: "NEW — view column: active members" },
    ],
    rls: "existing subscriptions RLS",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/subscriptions?organization_id=eq.{org}",
      input: "org",
      output: "SubscriptionV1Row",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    organization_id: "org_acme",
    plan: "Scale",
    status: "active",
    current_period_end: "2026-10-31T00:00:00Z",
    cancel_at_period_end: false,
    seats: 20,
    seats_used: 14,
  },
  map: mapSubscriptionV1,
  mock: () => PLAN,
  fetchReal: notBuilt("subscriptions.seats"),
});

// C-33 … C-35 ─ Flows 6–7 · Rooms & Messages (Lane 6 is mocks only — build last) ─
export const C33 = defineContract<RoomRow, ReturnType<typeof mapRoom>>({
  id: "C-33",
  order: 33,
  title: "Rooms",
  flows: ["Flow 6 · Rooms"],
  screens: ["O1", "O2", "O7", "O8", "O9", "O10", "O11", "O14", "B7", "shell sidebar"],
  gaps: ["12 rooms, room_members"],
  viewModel: { type: "Room", file: "types/room.ts" },
  domain: "rooms",
  table: {
    name: "rooms",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "slug", type: "text" },
      { name: "name", type: "text" },
      { name: "kind", type: { enum: ["channel", "brief", "coaching", "team", "deal"] } },
      { name: "topic", type: "text" },
      { name: "member_count", type: "int", note: "view column" },
      { name: "unread_count", type: "int", note: "view column, per viewer" },
      { name: "has_mention", type: "bool", note: "view column, per viewer" },
      { name: "is_member", type: "bool", note: "view column, per viewer" },
    ],
    rls: "members of the room (room_members) + org admins",
    notes:
      "Plus room_members(room_id, user_id, last_read_at). Realtime publication already exists (20260701000004).",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/v_rooms · POST /rooms",
      input: "{ name, kind, topic }",
      output: "RoomRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "room_objections",
    organization_id: "org_acme",
    slug: "objection-watch",
    name: "objection-watch",
    kind: "channel",
    topic: "Objections Bylda is tracking.",
    member_count: 12,
    unread_count: 9,
    has_mention: true,
    is_member: true,
  },
  map: mapRoom,
  mock: () => ROOMS[2],
  fetchReal: () => fetchRooms(),
});

export const C34 = defineContract<MessageRow, ReturnType<typeof mapMessage>>({
  id: "C-34",
  order: 34,
  title: "Messages, threads, reactions",
  flows: ["Flow 6 · Rooms", "Flow 7 · Messages"],
  screens: ["O2", "O3", "O4", "O5", "O12", "O13", "B7", "B8", "H6 (mentions)"],
  gaps: ["12 messages, threads", "05 mentions tab"],
  viewModel: { type: "Message", file: "types/room.ts" },
  domain: "rooms",
  table: {
    name: "messages",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "room_id", type: "uuid", nullable: true },
      { name: "thread_id", type: "uuid", nullable: true, note: "DM thread or reply thread" },
      { name: "author_id", type: "uuid" },
      { name: "author_name", type: "text" },
      { name: "is_app", type: "bool", note: "posted by Bylda — renders the APP badge" },
      { name: "body", type: "text" },
      {
        name: "block",
        type: "jsonb",
        nullable: true,
        note: "MessageBlock union: report | call | coaching | structured | insight",
      },
      { name: "reactions", type: "jsonb", note: "view column [{ symbol, count, mine }]" },
      { name: "reply_count", type: "int" },
      { name: "created_at", type: "timestamptz" },
    ],
    rls: "readers of the room / participants of the thread",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET · POST /rest/v1/messages?room_id=eq.{id}",
      input: "{ body, block? }",
      output: "MessageRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "m1",
    room_id: "room_objections",
    thread_id: null,
    author_id: "bylda",
    author_name: "Bylda",
    is_app: true,
    body: "Price objections handled early this week:",
    block: { type: "report", title: "Weekly report", meta: "Wk 39", reportId: "rep_weekly_39" },
    reactions: [{ symbol: "✓", count: 2, mine: true }],
    reply_count: 2,
    created_at: "2026-09-30T08:10:00Z",
  },
  map: mapMessage,
  mock: () => MESSAGES[2],
  fetchReal: () => fetchMessages({ roomId: "room_objections" }),
});

export const C35 = defineContract<DmThreadRow, ReturnType<typeof mapDmThread>>({
  id: "C-35",
  order: 35,
  title: "Direct-message threads (incl. BYLDA Coach DM)",
  flows: ["Flow 2 · Rep day (Coach DM)", "Flow 7 · Messages"],
  screens: ["O12", "O13", "B8", "B9", "shell sidebar"],
  gaps: ["12 DMs, BYLDA Coach DM"],
  viewModel: { type: "DmThread", file: "types/room.ts" },
  domain: "rooms",
  table: {
    name: "dm_threads",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "organization_id", type: "uuid" },
      { name: "title", type: "text", note: "view column — the other participant's name" },
      { name: "participant_ids", type: "uuid[]" },
      { name: "unread_count", type: "int" },
      { name: "is_coach", type: "bool" },
    ],
    rls: "participants only",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "GET /rest/v1/v_dm_threads",
      input: "—",
      output: "DmThreadRow[]",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "dm_1",
    organization_id: "org_acme",
    title: "Jordan Reyes",
    participant_ids: ["u_dana", "u_jordan"],
    unread_count: 2,
    is_coach: false,
  },
  map: mapDmThread,
  mock: () => DM_THREADS[0],
  fetchReal: notBuilt("dm_threads"),
});

export const C36 = defineContract<PushSubscriptionRow, ReturnType<typeof mapPushSubscription>>({
  id: "C-36",
  order: 36,
  title: "Mobile push registration",
  flows: ["Flow 2 · Rep day (mobile)"],
  screens: ["B1", "B2", "B4", "B5"],
  gaps: ["14 mobile push registration"],
  viewModel: { type: "PushRegistration", file: "types/notification.ts" },
  domain: "notifications",
  table: {
    name: "push_subscriptions",
    change: "new",
    columns: [
      { name: "id", type: "uuid" },
      { name: "user_id", type: "uuid" },
      { name: "platform", type: { enum: ["ios", "android", "web"] } },
      { name: "token", type: "text", note: "never returned to other users" },
      { name: "enabled", type: "bool" },
      { name: "created_at", type: "timestamptz" },
    ],
    rls: "user_id = auth.uid()",
  },
  endpoints: [
    {
      kind: "postgrest",
      name: "POST · DELETE /rest/v1/push_subscriptions",
      input: "{ platform, token }",
      output: "PushSubscriptionRow",
      auth: "JWT + RLS",
    },
  ],
  status: "Not started",
  example: {
    id: "push1",
    user_id: "u_jordan",
    platform: "ios",
    token: "tok_x",
    enabled: true,
    created_at: "2026-09-30T00:00:00Z",
  },
  map: mapPushSubscription,
  mock: () => ({ platform: "web" as const, enabled: false, registeredAt: null }),
  fetchReal: notBuilt("push_subscriptions"),
});

// C-37 ─ derived, no backend ───────────────────────────────────────────────────
export const C37 = defineContract<Record<string, unknown>, null>({
  id: "C-37",
  order: 37,
  title: "Call comparison — derived client-side (no backend)",
  flows: ["Flow 1 · Manager day (optional)"],
  screens: ["C8"],
  gaps: ["07 call comparison — derivable from two call_insights rows"],
  viewModel: { type: "CallComparison", file: "types/call.ts" },
  domain: "calls",
  table: null,
  endpoints: [
    {
      kind: "derived",
      name: "loadCallComparison(a, b)",
      input: "two call ids",
      output: "CallComparison (built from two CallReviews)",
      auth: "same as C-06",
    },
  ],
  status: "Derived — no backend",
  example: null,
  map: null,
  mock: () => null,
  fetchReal: null,
});
