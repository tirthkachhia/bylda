import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  guestStore,
  GUEST_USER,
  GUEST_ORG,
  GUEST_SUBSCRIPTION,
  GUEST_LEADS,
  GUEST_ASSETS,
  GUEST_TOOL_RUNS,
  GUEST_USAGE,
  GUEST_INTEGRATIONS,
  GUEST_INSIGHTS,
  GUEST_KPIS,
} from "@/lib/guest";

const isGuest = () => guestStore.get().isGuest;

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (isGuest())
        return {
          id: GUEST_USER.id,
          email: GUEST_USER.email,
          full_name: GUEST_USER.full_name,
          onboarding_complete: true,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const organizationQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["organization", orgId],
    queryFn: async () => {
      if (isGuest()) return GUEST_ORG;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export type OrgRole = "owner" | "admin" | "member";

export interface OrgMember {
  user_id: string;
  role: OrgRole;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

// Org member roster. Reads through the list_org_members SECURITY DEFINER RPC so
// members can see teammates without loosening profiles RLS. `supabase as any`
// mirrors the house escape hatch (see app.contacts.tsx) for tables/RPCs not in
// the generated types.
export const organizationMembersQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["org-members", orgId],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!orgId || isGuest()) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("list_org_members", { _org_id: orgId });
      if (error) throw error;
      return (data ?? []) as OrgMember[];
    },
    staleTime: 30_000,
  });

export const subscriptionQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["subscription", orgId],
    queryFn: async () => {
      if (isGuest()) return GUEST_SUBSCRIPTION;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export type PlanEntitlement = {
  plan: "starter" | "launch" | "operate" | "scale";
  price_usd: number;
  monthly_generation_limit: number | null;
  allowed_tools: string[];
  features: Record<string, unknown>;
  created_at: string;
};

// Fallback values used for guest mode and when DB has no row for a plan.
const PLAN_PRICES: Record<string, number> = {
  starter: 0,
  launch: 49,
  operate: 149,
  scale: 299,
};

const PLAN_GEN_LIMITS: Record<string, number | null> = {
  starter: 5,
  launch: 50,
  operate: 200,
  scale: null,
};

// Cumulative — each tier includes all tools from lower tiers.
// Keep in sync with plan_tier_limits table seed.
const PLAN_TOOLS: Record<string, string[]> = {
  starter: ["validate-idea", "generate-pitch", "persona-builder", "launch-checklist"],
  launch: [
    "validate-idea",
    "generate-pitch",
    "generate-gtm-strategy",
    "generate-offer",
    "kill-my-idea",
    "idea-vs-idea",
    "landing-page",
    "first-10-customers",
    "generate-followup-sequence",
    "blog",
    "social",
    "email_sequence",
    "sales_script",
    "cold_email",
    "pitch_deck",
    "lead_magnet",
    "niche_validator",
    "icp",
    "positioning-engine",
    "niche-scorer",
    "mvp-planner",
    "competitor-scanner",
    "gtm-strategy-builder",
    "business-plan-generator",
    "persona-builder",
    "pricing-calculator",
    "first-10-customers-finder",
    "landing-page-creator",
    "kpi-dashboard",
    "seo-audit",
    "launch-checklist",
    "ad-copy",
  ],
  operate: [
    "validate-idea",
    "generate-pitch",
    "generate-gtm-strategy",
    "generate-offer",
    "kill-my-idea",
    "idea-vs-idea",
    "landing-page",
    "first-10-customers",
    "generate-followup-sequence",
    "generate-ops-plan",
    "funding-score",
    "investor-emails",
    "business-plan",
    "analyze-website",
    "blog",
    "social",
    "email_sequence",
    "sales_script",
    "cold_email",
    "pitch_deck",
    "lead_magnet",
    "niche_validator",
    "icp",
    "positioning-engine",
    "niche-scorer",
    "mvp-planner",
    "ad_creative",
    "vsl",
    "automation",
    "client_report",
    "competitor-scanner",
    "gtm-strategy-builder",
    "business-plan-generator",
    "persona-builder",
    "pricing-calculator",
    "first-10-customers-finder",
    "landing-page-creator",
    "kpi-dashboard",
    "seo-audit",
    "launch-checklist",
    "ad-copy",
    "investor-email-writer",
    "funding-readiness-score",
  ],
  scale: [
    "validate-idea",
    "generate-pitch",
    "generate-gtm-strategy",
    "generate-offer",
    "kill-my-idea",
    "idea-vs-idea",
    "landing-page",
    "first-10-customers",
    "generate-followup-sequence",
    "generate-ops-plan",
    "funding-score",
    "investor-emails",
    "business-plan",
    "analyze-website",
    "competitor-analysis",
    "pricing-strategy",
    "revenue-projector",
    "blog",
    "social",
    "email_sequence",
    "sales_script",
    "cold_email",
    "pitch_deck",
    "lead_magnet",
    "niche_validator",
    "icp",
    "positioning-engine",
    "niche-scorer",
    "mvp-planner",
    "ad_creative",
    "vsl",
    "automation",
    "client_report",
    "competitor-scanner",
    "gtm-strategy-builder",
    "business-plan-generator",
    "persona-builder",
    "pricing-calculator",
    "first-10-customers-finder",
    "landing-page-creator",
    "kpi-dashboard",
    "seo-audit",
    "launch-checklist",
    "ad-copy",
    "investor-email-writer",
    "funding-readiness-score",
  ],
};

export const planEntitlementsQuery = () =>
  queryOptions({
    queryKey: ["plan_tier_limits"],
    queryFn: async (): Promise<PlanEntitlement[]> => {
      const plans = ["starter", "launch", "operate", "scale"] as const;
      if (isGuest()) {
        return plans.map((plan) => ({
          plan,
          price_usd: PLAN_PRICES[plan] ?? 0,
          monthly_generation_limit: PLAN_GEN_LIMITS[plan] ?? null,
          allowed_tools: PLAN_TOOLS[plan] ?? [],
          features: {},
          created_at: new Date().toISOString(),
        }));
      }
      const { data, error } = await supabase.from("plan_tier_limits").select("*");
      if (error) throw error;
      return plans.map((plan) => {
        const row = (data ?? []).find((r) => r.plan === plan);
        return {
          plan,
          price_usd: row?.price_usd ?? PLAN_PRICES[plan] ?? 0,
          monthly_generation_limit: row?.monthly_generation_limit ?? PLAN_GEN_LIMITS[plan] ?? null,
          allowed_tools: (row?.allowed_tools as string[] | null) ?? PLAN_TOOLS[plan] ?? [],
          features: {},
          created_at: row?.created_at ?? new Date().toISOString(),
        };
      });
    },
  });

export const toolRunsQuery = (orgId: string, limit = 20) =>
  queryOptions({
    queryKey: ["tool_runs", orgId, limit],
    queryFn: async () => {
      if (isGuest()) return GUEST_TOOL_RUNS.slice(0, limit);
      const { data, error } = await supabase
        .from("tool_runs")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

export const generatedAssetsQuery = (orgId: string, kind?: string) =>
  queryOptions({
    queryKey: ["generated_assets", orgId, kind ?? "all"],
    queryFn: async () => {
      if (isGuest()) return kind ? GUEST_ASSETS.filter((a) => a.kind === kind) : GUEST_ASSETS;
      let q = supabase.from("generated_assets").select("*").eq("organization_id", orgId);
      if (kind) q = q.eq("kind", kind);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

export const usageQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["usage", orgId],
    queryFn: async () => {
      if (isGuest()) return GUEST_USAGE;
      const period = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase
        .from("usage_tracking")
        .select("*")
        .eq("organization_id", orgId)
        .eq("period", period);
      if (error) throw error;
      return data ?? [];
    },
  });

export const websiteAnalysesQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["website_analyses", orgId],
    queryFn: async () => {
      if (isGuest()) return [];
      const { data, error } = await supabase
        .from("website_analyses")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const leadsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["leads", orgId],
    queryFn: async () => {
      if (isGuest()) return GUEST_LEADS;
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const recentMomentumQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["recent-momentum", orgId],
    queryFn: async () => {
      if (!orgId || isGuest()) return { windowDays: 7, counts: {} as Record<string, number> };

      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("bylda_events")
        .select("event_type")
        .eq("organization_id", orgId)
        .gte("created_at", sevenDaysAgo);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
      }
      return { windowDays: 7, counts };
    },
  });

/** The single most recent "win" event, for the in-the-moment celebration chip. */
export const latestWinQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["latest-win", orgId],
    queryFn: async (): Promise<{ event_type: string; created_at: string } | null> => {
      if (!orgId || isGuest()) return null;
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      const { data } = await supabase
        .from("bylda_events")
        .select("event_type, created_at")
        .eq("organization_id", orgId)
        .in("event_type", [
          "step.completed",
          "mission.completed",
          "course.generated",
          "track.graduation",
          "contact.created",
        ])
        .gte("created_at", twoDaysAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as { event_type: string; created_at: string } | null) ?? null;
    },
    staleTime: 30_000,
  });

export type MaskedIntegration = {
  id: string;
  user_id: string;
  integration_key: string;
  status: string;
  value_last4: string | null;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
};

export const integrationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["user_integrations", userId],
    queryFn: async (): Promise<MaskedIntegration[]> => {
      if (isGuest()) return GUEST_INTEGRATIONS as MaskedIntegration[];
      const { data, error } = await supabase
        .from("user_integrations_masked")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as MaskedIntegration[];
    },
  });

export async function saveIntegration(integrationKey: string, value: string) {
  const { data, error } = await supabase.functions.invoke("save-integration", {
    body: { integration_key: integrationKey, value },
  });
  if (error) throw error;
  return data;
}

export async function disconnectIntegration(userId: string, integrationKey: string) {
  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("integration_key", integrationKey);
  if (error) throw error;
}

// ── Company Memory ────────────────────────────────────────────────────────────

export type MemorySource = {
  id: string;
  org_id: string;
  user_id: string;
  source_type: string;
  source_label: string | null;
  source_url: string | null;
  status: "pending" | "indexing" | "indexed" | "error";
  error_message: string | null;
  artifact_count: number;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MemoryArtifact = {
  id: string;
  org_id: string;
  user_id: string;
  source_id: string | null;
  source_type: string;
  source_label: string | null;
  title: string;
  content_preview: string | null;
  content_hash: string | null;
  token_count: number | null;
  status: "indexed" | "stale" | "error";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const memorySourcesQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["memory_sources", orgId],
    queryFn: async (): Promise<MemorySource[]> => {
      if (isGuest()) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db
        .from("memory_sources")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MemorySource[];
    },
  });

export const memoryArtifactsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["memory_artifacts", orgId],
    queryFn: async (): Promise<MemoryArtifact[]> => {
      if (isGuest()) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db
        .from("memory_artifacts")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as MemoryArtifact[];
    },
  });

export async function addMemorySource(
  orgId: string,
  userId: string,
  payload: Pick<MemorySource, "source_type" | "source_label" | "source_url">,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("memory_sources")
    .insert({ org_id: orgId, user_id: userId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as MemorySource;
}

export async function deleteMemorySource(sourceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db.from("memory_sources").delete().eq("id", sourceId);
  if (error) throw error;
}

// ── AI Dashboard ─────────────────────────────────────────────────────────────

// All fields optional: the edge function resolves the org from the session and
// backfills any missing field from the saved onboarding_responses row.
export type GenerateDashboardInput = {
  business?: string;
  niche?: string;
  stage?: string;
  goal?: string;
  current_revenue?: string;
  target_customer?: string;
  biggest_blocker?: string;
  organization_id?: string;
};

export const onboardingResponseQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["onboarding_response", orgId],
    queryFn: async () => {
      if (isGuest()) return null;
      const { data, error } = await supabase
        .from("onboarding_responses")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const aiDashboardQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["ai_dashboard", orgId],
    queryFn: async () => {
      if (isGuest()) return null;
      // generate-ai-dashboard INSERTS a row per generation — always read the latest,
      // never .maybeSingle() (throws once a dashboard has been regenerated).
      const { data, error } = await supabase
        .from("ai_dashboards")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

export async function generateAiDashboard(input: GenerateDashboardInput) {
  const { data, error } = await supabase.functions.invoke("generate-ai-dashboard", {
    body: input,
  });
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mentor Agent Queries
// ─────────────────────────────────────────────────────────────────────────────

export type MentorMessage = {
  role: "user" | "agent";
  text: string;
  ts: string;
};

export type MentorSession = {
  id: string;
  org_id: string;
  user_id: string;
  agent_id: string;
  messages: MentorMessage[];
  created_at: string;
  updated_at: string;
};

export type MentorInsight = {
  id: string;
  org_id: string;
  agent_id: string;
  type: "signal" | "opportunity" | "warning" | "recommendation";
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  n8n_run_id: string | null;
  created_at: string;
  // UI-derived fields (enriched client-side)
  color?: string;
  agent?: string;
  ago?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const mentorSessionQuery = (orgId: string, agentId: string) =>
  queryOptions({
    queryKey: ["mentor_session", orgId, agentId],
    queryFn: async (): Promise<MentorSession | null> => {
      if (isGuest()) return null;
      const { data, error } = await db
        .from("mentor_agent_sessions")
        .select("*")
        .eq("org_id", orgId)
        .eq("agent_id", agentId)
        .maybeSingle();
      if (error) throw error;
      return data as MentorSession | null;
    },
    staleTime: 0,
  });

export const mentorInsightsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["mentor_insights", orgId],
    queryFn: async (): Promise<MentorInsight[]> => {
      if (isGuest()) return GUEST_INSIGHTS as unknown as MentorInsight[];
      const { data, error } = await db
        .from("mentor_insights")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as MentorInsight[];
    },
  });

/** Upsert (create or append message) for a mentor chat session. */
export async function saveMentorMessage(
  orgId: string,
  userId: string,
  agentId: string,
  newMessages: MentorMessage[],
): Promise<void> {
  const { data: existing } = await db
    .from("mentor_agent_sessions")
    .select("messages")
    .eq("org_id", orgId)
    .eq("agent_id", agentId)
    .maybeSingle();

  const prior: MentorMessage[] = (existing?.messages as MentorMessage[]) ?? [];
  const merged = [...prior, ...newMessages];

  const { error } = await db.from("mentor_agent_sessions").upsert(
    {
      org_id: orgId,
      user_id: userId,
      agent_id: agentId,
      messages: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,agent_id" },
  );
  if (error) throw error;
}

/** Mark all insights for an org as read. */
export async function markInsightsRead(orgId: string): Promise<void> {
  const { error } = await db
    .from("mentor_insights")
    .update({ read: true })
    .eq("org_id", orgId)
    .eq("read", false);
  if (error) throw error;
}

/** The Business Context Graph — the canonical context every AI surface reads. */
export const businessContextQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["business_context", orgId],
    queryFn: async () => {
      if (!orgId || isGuest()) return null;
      const { data, error } = await supabase
        .from("business_context")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

/** Workspace mode + provisioning status — drives mode-aware Home and the repair CTA. */
export const workspaceStatusQuery = (userId: string) =>
  queryOptions({
    queryKey: ["workspace-status", userId],
    queryFn: async () => {
      if (!userId || isGuest()) return null;
      const { data } = await supabase
        .from("workspaces")
        .select("id, mode, provisioning_status, lane")
        .eq("owner_id", userId)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 60_000,
  });

/** Current active mission for the user's workspace. */
export const currentMissionQuery = (userId: string) =>
  queryOptions({
    queryKey: ["current-mission", userId],
    queryFn: async () => {
      if (!userId || isGuest()) return null;
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, lane, current_mission_id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!ws) return null;

      const { data: mission } = await supabase
        .from("missions")
        .select("id, title, description, lane, status")
        .eq("workspace_id", ws.id)
        .eq("status", "active")
        .order("sort_order")
        .limit(1)
        .maybeSingle();

      if (!mission) return { workspace: ws, mission: null, steps: [] };

      const { data: steps } = await supabase
        .from("mission_steps")
        .select("id, title, description, tool_key, status, sort_order")
        .eq("mission_id", mission.id)
        .order("sort_order");

      return { workspace: ws, mission, steps: steps ?? [] };
    },
    staleTime: 30_000,
    retry: 4,
    retryDelay: 5_000,
  });

/** Derive live KPI metrics from existing tables (no new DB tables needed). */
export const mentorKPIsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["mentor_kpis", orgId],
    queryFn: async () => {
      if (isGuest()) return GUEST_KPIS;

      // Parallel fetch from existing tables
      const [leadsRes, runsRes, autoRes] = await Promise.all([
        supabase.from("leads").select("id,stage,value").eq("organization_id", orgId),
        supabase
          .from("tool_runs")
          .select("id,status,tool_key,created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("automation_settings").select("id,enabled").eq("organization_id", orgId),
      ]);

      const leads = leadsRes.data ?? [];
      const runs = runsRes.data ?? [];
      const autos = autoRes.data ?? [];

      const wonLeads = leads.filter((l) => l.stage === "Won").length;
      const totalLeads = leads.length;
      const pipelineValue = leads.reduce(
        (s, l) => s + ((l as { value?: number }).value ?? 3200),
        0,
      );
      const completedRuns = runs.filter((r) => r.status === "succeeded").length;
      const activeAutomations = autos.filter(
        (a) => (a as { enabled?: boolean }).enabled === true,
      ).length;

      // Execution index: weighted score from activity signals
      const execIndex = Math.min(
        100,
        Math.round(
          Math.min(completedRuns * 4, 40) +
            Math.min(activeAutomations * 12, 24) +
            Math.min(wonLeads * 8, 24) +
            (totalLeads > 0 ? 12 : 0),
        ),
      );

      // CAC ratio heuristic (improves as closed deals grow vs total runs cost)
      const cacRatio =
        completedRuns > 0
          ? Math.min(
              4.0,
              Math.max(
                0.5,
                wonLeads > 0 ? (wonLeads * 3.5) / Math.max(1, completedRuns * 0.3) : 0.8,
              ),
            )
          : 0;

      return {
        mrr: wonLeads * 420, // rough MRR signal per won deal
        pipelineValue,
        execIndex,
        cacRatio: Math.round(cacRatio * 10) / 10,
        wonLeads,
        totalLeads,
        completedRuns,
        activeAutomations,
      };
    },
  });

// ── Launch Control Center ──────────────────────────────────────────────────────
// The control center composes mentorKPIsQuery directly (it already exists)
// alongside this query, which owns just the two genuinely-new aggregations:
// the analytics-install checklist and the feedback capture feed.

const ANALYTICS_CHECKLIST_KEYS: { key: string; label: string }[] = [
  { key: "googleanalytics", label: "Web analytics (Google Analytics)" },
  { key: "facebook_api", label: "Meta / Facebook Ads pixel" },
  { key: "stripe", label: "Payments (Stripe)" },
  { key: "mailchimp", label: "Email marketing tool" },
];
const EMAIL_TOOL_KEYS = ["mailchimp", "klaviyo", "convertkit"];

export type ToolFeedbackEntry = {
  runId: string;
  toolKey: string;
  feedback: string;
  feedbackAt: string | null;
};

export type LaunchControlExtras = {
  analyticsChecklist: { key: string; label: string; connected: boolean }[];
  feedback: ToolFeedbackEntry[];
  insights: MentorInsight[];
};

export const launchControlExtrasQuery = (orgId: string, userId: string) =>
  queryOptions({
    queryKey: ["launch_control_extras", orgId, userId],
    queryFn: async (): Promise<LaunchControlExtras> => {
      if (isGuest() || !orgId) {
        return {
          analyticsChecklist: ANALYTICS_CHECKLIST_KEYS.map((a) => ({ ...a, connected: false })),
          feedback: [],
          insights: [],
        };
      }

      const [integrationsRes, runsRes, insightsRes] = await Promise.all([
        userId
          ? db
              .from("user_integrations_masked")
              .select("integration_key,is_connected")
              .eq("user_id", userId)
          : Promise.resolve({ data: [] as { integration_key: string; is_connected: boolean }[] }),
        db
          .from("tool_runs")
          .select("id,tool_key,feedback,feedback_at")
          .eq("organization_id", orgId)
          .not("feedback", "is", null)
          .order("feedback_at", { ascending: false })
          .limit(8),
        db
          .from("mentor_insights")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const connectedKeys = new Set(
        ((integrationsRes.data ?? []) as { integration_key: string; is_connected: boolean }[])
          .filter((i) => i.is_connected)
          .map((i) => i.integration_key),
      );
      const analyticsChecklist = ANALYTICS_CHECKLIST_KEYS.map((a) => ({
        ...a,
        connected:
          connectedKeys.has(a.key) ||
          (a.key === "mailchimp" && EMAIL_TOOL_KEYS.some((k) => connectedKeys.has(k))),
      }));

      const feedback: ToolFeedbackEntry[] = ((runsRes.data ?? []) as Record<string, unknown>[]).map(
        (r) => ({
          runId: String(r.id),
          toolKey: String(r.tool_key ?? ""),
          feedback: String(r.feedback ?? ""),
          feedbackAt: (r.feedback_at as string | null) ?? null,
        }),
      );

      return {
        analyticsChecklist,
        feedback,
        insights: (insightsRes.data ?? []) as MentorInsight[],
      };
    },
    staleTime: 30_000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Template applications
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateApplication {
  id: string;
  organization_id: string;
  template_slug: string;
  applied_at: string;
  customizations: Record<string, unknown>;
}

export function templateApplicationsQuery(orgId: string) {
  return queryOptions({
    queryKey: ["template_applications", orgId],
    queryFn: async () => {
      if (!orgId) return [] as TemplateApplication[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("template_applications")
        .select("*")
        .eq("organization_id", orgId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TemplateApplication[];
    },
    staleTime: 60_000,
  });
}

export async function applyTemplate(orgId: string, templateSlug: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("template_applications").insert({
    organization_id: orgId,
    template_slug: templateSlug,
  });
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval requests
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalRequestType =
  | "content_publish"
  | "automation_change"
  | "budget_spend"
  | "client_communication";

export interface ApprovalRequest {
  id: string;
  organization_id: string;
  requested_by: string;
  request_type: ApprovalRequestType;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  approver_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  related_mission_id: string | null;
  created_at: string;
  updated_at: string;
}

export function approvalRequestsQuery(orgId: string, status?: ApprovalStatus) {
  return queryOptions({
    queryKey: ["approval_requests", orgId, status ?? "all"],
    queryFn: async () => {
      if (!orgId) return [] as ApprovalRequest[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      let q = sb
        .from("approval_requests")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ApprovalRequest[];
    },
    staleTime: 30_000,
  });
}

export async function createApprovalRequest(
  orgId: string,
  requestedBy: string,
  fields: {
    request_type: ApprovalRequestType;
    title: string;
    description?: string;
    payload?: Record<string, unknown>;
    related_mission_id?: string;
  },
): Promise<ApprovalRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("approval_requests")
    .insert({ organization_id: orgId, requested_by: requestedBy, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as ApprovalRequest;
}

export async function decideApprovalRequest(
  requestId: string,
  decision: "approved" | "rejected",
  approverId: string,
  note?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("approval_requests")
    .update({
      status: decision,
      approver_id: approverId,
      decided_at: new Date().toISOString(),
      decision_note: note ?? null,
    })
    .eq("id", requestId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring layer (deviation alerts, expected outcomes, open loops)
// Tables use org_id = auth.uid() RLS (single-owner, v1)
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviationAlert {
  id: string;
  org_id: string;
  expected_outcome_id: string | null;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  diagnosis: string | null;
  status: "open" | "acknowledged" | "resolved";
  triggered_at: string;
  resolved_at: string | null;
}

export interface ExpectedOutcome {
  id: string;
  org_id: string;
  metric_name: string;
  target_value: number;
  target_unit: string | null;
  check_date: string;
  tolerance_pct: number;
  created_at: string;
}

export interface OpenLoop {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "dropped";
  created_at: string;
  updated_at: string;
}

export interface FailedJob {
  id: string;
  user_id: string | null;
  tool_slug: string;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string;
  status: "pending" | "retrying" | "resolved" | "dead";
  created_at: string;
}

export interface N8nErrorLogEntry {
  id: string;
  workflow_name: string;
  error_message: string | null;
  error_node: string | null;
  execution_id: string | null;
  occurred_at: string;
}

export const deviationAlertsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["deviation_alerts", userId],
    queryFn: async () => {
      if (!userId || isGuest()) return [] as DeviationAlert[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("deviation_alerts")
        .select("*")
        .eq("org_id", userId)
        .order("triggered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as DeviationAlert[];
    },
    staleTime: 30_000,
  });

export const expectedOutcomesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["expected_outcomes", userId],
    queryFn: async () => {
      if (!userId || isGuest()) return [] as ExpectedOutcome[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("expected_outcomes")
        .select("*")
        .eq("org_id", userId)
        .order("check_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ExpectedOutcome[];
    },
    staleTime: 60_000,
  });

export const openLoopsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["open_loops", userId],
    queryFn: async () => {
      if (!userId || isGuest()) return [] as OpenLoop[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("open_loops")
        .select("*")
        .eq("org_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpenLoop[];
    },
    staleTime: 60_000,
  });

export const failedJobsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["failed_jobs", userId],
    queryFn: async () => {
      if (!userId || isGuest()) return [] as FailedJob[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("failed_jobs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as FailedJob[];
    },
    staleTime: 30_000,
  });

export const n8nErrorLogQuery = () =>
  queryOptions({
    queryKey: ["n8n_error_log"],
    queryFn: async () => {
      if (isGuest()) return [] as N8nErrorLogEntry[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("n8n_error_log")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as N8nErrorLogEntry[];
    },
    staleTime: 60_000,
  });

export async function acknowledgeAlert(alertId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("deviation_alerts")
    .update({ status: "acknowledged" })
    .eq("id", alertId);
  if (error) throw error;
}

export async function resolveAlert(alertId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("deviation_alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROI analytics (derived — no new tables, mirrors mentorKPIsQuery pattern)
// ─────────────────────────────────────────────────────────────────────────────

// Estimated minutes saved per tool category (heuristic, v1)
const CATEGORY_TIME_SAVED_MINS: Record<string, number> = {
  validate: 45,
  plan: 90,
  customers: 60,
  launch: 75,
  funding: 120,
};

export interface RoiAnalytics {
  totalTimeSavedHrs: number;
  totalToolRuns: number;
  activeAutomations: number;
  wonLeadsValue: number;
  estimatedPipelineValue: number;
  runsByCategory: Record<string, number>;
}

export const roiAnalyticsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["roi_analytics", orgId],
    queryFn: async (): Promise<RoiAnalytics> => {
      if (isGuest()) {
        const sumVal = (rows: typeof GUEST_LEADS) => rows.reduce((s, l) => s + l.value, 0);
        const open = GUEST_LEADS.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
        return {
          totalTimeSavedHrs: 47,
          totalToolRuns: GUEST_TOOL_RUNS.length,
          activeAutomations: 5,
          wonLeadsValue: sumVal(GUEST_LEADS.filter((l) => l.stage === "Won")),
          estimatedPipelineValue: sumVal(open),
          runsByCategory: { validate: 3, plan: 6, customers: 2, launch: 4, funding: 1 },
        };
      }
      if (!orgId) {
        return {
          totalTimeSavedHrs: 0,
          totalToolRuns: 0,
          activeAutomations: 0,
          wonLeadsValue: 0,
          estimatedPipelineValue: 0,
          runsByCategory: {},
        };
      }

      const [runsRes, autoRes, leadsRes] = await Promise.all([
        supabase
          .from("tool_runs")
          .select("id,status,tool_key,created_at")
          .eq("organization_id", orgId)
          .eq("status", "succeeded")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("automation_settings").select("id,enabled").eq("organization_id", orgId),
        supabase.from("leads").select("id,stage,value").eq("organization_id", orgId),
      ]);

      const runs = runsRes.data ?? [];
      const autos = autoRes.data ?? [];
      const leads = leadsRes.data ?? [];

      // We need LAUNCHPAD_TOOLS to map tool_key → category
      // Import dynamically to avoid circular deps — use a static fallback map instead
      const TOOL_CATEGORY_MAP: Record<string, string> = {
        "validate-idea": "validate",
        "niche-scorer": "validate",
        "mvp-planner": "plan",
        "positioning-engine": "plan",
        "competitor-scanner": "plan",
        "persona-builder": "plan",
        "pricing-calculator": "plan",
        "first-10-customers-finder": "customers",
        "pitch-generator": "launch",
        "landing-page-creator": "launch",
        "email-sequence": "launch",
        "ad-copy": "launch",
        "launch-checklist": "launch",
        "funding-readiness": "funding",
        "kpi-dashboard": "plan",
        "idea-validator": "validate",
      };

      const runsByCategory: Record<string, number> = {};
      let totalTimeMins = 0;

      for (const run of runs) {
        const category = TOOL_CATEGORY_MAP[run.tool_key ?? ""] ?? "plan";
        runsByCategory[category] = (runsByCategory[category] ?? 0) + 1;
        totalTimeMins += CATEGORY_TIME_SAVED_MINS[category] ?? 45;
      }

      const activeAutomations = autos.filter(
        (a) => (a as { enabled?: boolean }).enabled === true,
      ).length;

      const wonLeadsValue = leads
        .filter((l) => l.stage === "Won")
        .reduce((s, l) => s + (Number(l.value) || 0), 0);

      const estimatedPipelineValue = leads
        .filter((l) => l.stage !== "Lost" && l.stage !== "Won")
        .reduce((s, l) => s + (Number(l.value) || 0), 0);

      return {
        totalTimeSavedHrs: Math.round(totalTimeMins / 60),
        totalToolRuns: runs.length,
        activeAutomations,
        wonLeadsValue,
        estimatedPipelineValue,
        runsByCategory,
      };
    },
    staleTime: 120_000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// SOP documents
// ─────────────────────────────────────────────────────────────────────────────

export type SopStatus = "draft" | "published" | "archived";

export interface SopDocument {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  category: string | null;
  content: string;
  related_tool_keys: string[];
  related_module_ids: string[];
  status: SopStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export const sopDocumentsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["sop_documents", orgId],
    queryFn: async () => {
      if (!orgId || isGuest()) return [] as SopDocument[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb
        .from("sop_documents")
        .select("*")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SopDocument[];
    },
    staleTime: 60_000,
  });

export async function upsertSopDocument(
  orgId: string,
  userId: string,
  fields: {
    id?: string;
    title: string;
    category?: string;
    content?: string;
    status?: SopStatus;
    related_tool_keys?: string[];
    related_module_ids?: string[];
  },
): Promise<SopDocument> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const payload = {
    organization_id: orgId,
    created_by: userId,
    ...fields,
  };
  const { data, error } = fields.id
    ? await sb.from("sop_documents").update(payload).eq("id", fields.id).select().single()
    : await sb.from("sop_documents").insert(payload).select().single();
  if (error) throw error;
  return data as SopDocument;
}

export async function deleteSopDocument(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb.from("sop_documents").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log (admin-only)
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  email: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const auditLogQuery = (limit = 200) =>
  queryOptions({
    queryKey: ["admin_audit_log", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AuditLogEntry[];
    },
    staleTime: 30_000,
  });
