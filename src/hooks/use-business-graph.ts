// Business Graph — the underlying intelligence layer of Bylda OS.
// Aggregates business state from existing queries into a single graph that
// every page reads from: metrics that matter, blockers in the way, and
// AI-recommended next moves. Users never see the graph directly — they feel
// it through Mission Control, Outcome Engines, and Bylda recommendations.
//
// BYLDA_OS_REDESIGN.md · Part 5 — pure frontend aggregation, no backend changes.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  toolRunsQuery,
  leadsQuery,
  organizationQuery,
  currentMissionQuery,
  mentorKPIsQuery,
  workspaceStatusQuery,
} from "@/lib/queries";

/* ─── Types ─────────────────────────────────────────────────── */

export type BusinessMode = "create" | "operate";
export type BusinessStage = "Idea" | "Validate" | "Launch" | "Operate" | "Scale";

export interface KeyMetric {
  id: string;
  label: string;
  value: string;
  target?: string;
  status: "on-track" | "behind" | "neutral";
  /** Where to act on this metric */
  actionTo: string;
  actionLabel: string;
}

export interface Blocker {
  id: string;
  severity: "critical" | "high" | "medium";
  title: string;
  why: string;
  /** Route that resolves this blocker */
  resolveTo: string;
  resolveLabel: string;
  estimatedMinutes: number;
}

export interface Recommendation {
  id: string;
  title: string;
  impact: string;
  estimatedMinutes: number;
  to: string;
}

export interface LeadRow {
  id: string;
  name: string | null;
  source: string | null;
  stage: string | null;
  value: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BusinessGraph {
  isLoading: boolean;
  mode: BusinessMode;
  stage: BusinessStage;
  businessName: string;
  goal: string;
  metrics: KeyMetric[];
  blockers: Blocker[];
  recommendations: Recommendation[];
  /** Lead rows for tables and charts (newest first) */
  leads: LeadRow[];
  /** Raw signals other components can use */
  signals: {
    toolRunCount: number;
    leadCount: number;
    activeAutomationCount: number;
    hasOffer: boolean;
    hasGtm: boolean;
    hasValidatedIdea: boolean;
    hasFollowupSequence: boolean;
    missionActive: boolean;
    missionProgress: number; // 0–1
    /** tool_keys with at least one succeeded run */
    succeededToolKeys: string[];
    /** A "track.graduated" bylda_event fired in the last 14 days */
    recentlyGraduated: boolean;
    /** Days since the most recent "step.completed" bylda_event, or null if none yet */
    daysSinceLastStepCompleted: number | null;
  };
}

/* ─── Hook ──────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useBusinessGraph(): BusinessGraph {
  const { user, currentOrgId } = useAuth();
  const userId = user?.id ?? "";
  const orgId = currentOrgId ?? "";

  const orgQ = useQuery({ ...organizationQuery(orgId), enabled: !!orgId });
  const runsQ = useQuery({ ...toolRunsQuery(orgId, 500), enabled: !!orgId });
  const leadsQ = useQuery({ ...leadsQuery(orgId), enabled: !!orgId });
  const kpisQ = useQuery({ ...mentorKPIsQuery(orgId), enabled: !!orgId });
  const missionQ = useQuery({ ...currentMissionQuery(userId), enabled: !!userId });
  const wsQ = useQuery({ ...workspaceStatusQuery(userId), enabled: !!userId });

  const automationsQ = useQuery({
    queryKey: ["business-graph-automations", userId],
    queryFn: async () => {
      const { data } = await db
        .from("automation_configs")
        .select("id, enabled")
        .eq("user_id", userId);
      return (data ?? []) as Array<{ id: string; enabled: boolean }>;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Recent bylda_events (last 14 days), scoped to just what the graduation and
  // resume-momentum signals need — event_type + created_at, newest first.
  const eventsQ = useQuery({
    queryKey: ["business-graph-bylda-events", orgId],
    queryFn: async () => {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data } = await db
        .from("bylda_events")
        .select("event_type, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", fourteenDaysAgo)
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{ event_type: string; created_at: string }>;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const isLoading = orgQ.isLoading || runsQ.isLoading || missionQ.isLoading;

  const org = orgQ.data as {
    name?: string;
    stage?: string;
    goal?: string;
  } | null;

  const ws = wsQ.data as { mode?: string } | null;
  // Stage is read from organizations.stage — the canonical, user-updatable value
  // (Settings writes it; onboarding keeps it current). workspaces.stage was frozen
  // at the onboarding value and is no longer read.
  const stage = (org?.stage as BusinessStage) || "Idea";
  const mode: BusinessMode = ws?.mode === "operate" ? "operate" : "create";

  /* ── Signals: what has the user actually done? ── */
  const runs = (runsQ.data ?? []) as Array<{ tool_key?: string; status: string }>;
  const succeededKeys = new Set(
    runs.filter((r) => r.status === "succeeded").map((r) => r.tool_key ?? ""),
  );

  const hasRunAny = (...keys: string[]) => keys.some((k) => succeededKeys.has(k));

  const leads = (leadsQ.data ?? []) as unknown[];
  const automations = automationsQ.data ?? [];
  const activeAutomationCount = automations.filter((a) => a.enabled).length;

  const mission = missionQ.data as {
    mission?: { title: string };
    steps?: Array<{ status: string }>;
  } | null;
  const missionSteps = mission?.steps ?? [];
  const missionDone = missionSteps.filter(
    (s) => s.status === "completed" || s.status === "skipped",
  ).length;

  // bylda_events-derived signals (events are ordered newest-first from the query).
  const byldaEvents = eventsQ.data ?? [];
  const recentlyGraduated = byldaEvents.some((e) => e.event_type === "track.graduated");
  const lastStepCompleted = byldaEvents.find((e) => e.event_type === "step.completed");
  // null (not 0) when a step has never been completed — a brand-new org is not
  // "stalled", so it shouldn't get a re-engagement nudge.
  const daysSinceLastStepCompleted = lastStepCompleted
    ? Math.floor((Date.now() - new Date(lastStepCompleted.created_at).getTime()) / 86400000)
    : null;

  const signals = {
    toolRunCount: runs.filter((r) => r.status === "succeeded").length,
    leadCount: leads.length,
    activeAutomationCount,
    hasOffer: hasRunAny("offer", "generate-offer"),
    hasGtm: hasRunAny("gtm-strategy", "gtm-strategy-builder", "generate-gtm-strategy"),
    hasValidatedIdea: hasRunAny("idea-validator", "validate-idea"),
    hasFollowupSequence: hasRunAny("followup", "generate-followup-sequence"),
    missionActive: !!mission?.mission,
    missionProgress: missionSteps.length > 0 ? missionDone / missionSteps.length : 0,
    succeededToolKeys: [...succeededKeys].filter(Boolean),
    recentlyGraduated,
    daysSinceLastStepCompleted,
  };

  /* ── Key metrics: only the 3 numbers that matter for this mode ── */
  const kpis = kpisQ.data as { pipelineValue?: number; execIndex?: number } | undefined;
  const pipelineValue = kpis?.pipelineValue ?? 0;

  const metrics: KeyMetric[] =
    mode === "create"
      ? [
          {
            id: "pipeline",
            label: "Pipeline",
            value: pipelineValue > 0 ? `$${(pipelineValue / 1000).toFixed(1)}k` : "$0",
            target: "First revenue",
            status: pipelineValue > 0 ? "on-track" : "neutral",
            actionTo: "/app/bylda/crm",
            actionLabel: "View pipeline",
          },
          {
            id: "leads",
            label: "Leads",
            value: String(signals.leadCount),
            target: "10",
            status:
              signals.leadCount >= 10 ? "on-track" : signals.leadCount > 0 ? "neutral" : "behind",
            actionTo: "/app/contacts",
            actionLabel: "Add leads",
          },
          {
            id: "execution",
            label: "Execution",
            value: `${signals.toolRunCount} runs`,
            status: signals.toolRunCount >= 3 ? "on-track" : "neutral",
            actionTo: "/app/mission-control",
            actionLabel: "Continue mission",
          },
        ]
      : [
          {
            id: "pipeline",
            label: "Pipeline",
            value: pipelineValue > 0 ? `$${(pipelineValue / 1000).toFixed(1)}k` : "$0",
            status: pipelineValue > 0 ? "on-track" : "neutral",
            actionTo: "/app/bylda/crm",
            actionLabel: "View pipeline",
          },
          {
            id: "automations",
            label: "Automations",
            value: String(activeAutomationCount),
            target: "3+",
            status: activeAutomationCount >= 1 ? "on-track" : "behind",
            actionTo: "/app/automations",
            actionLabel: "Automate work",
          },
          {
            id: "leads",
            label: "Contacts",
            value: String(signals.leadCount),
            status: "neutral",
            actionTo: "/app/contacts",
            actionLabel: "View contacts",
          },
        ];

  /* ── Blockers: what's structurally in the way of progress? ── */
  const blockers: Blocker[] = [];

  if (mode === "create") {
    if (!signals.hasValidatedIdea && stage === "Idea") {
      blockers.push({
        id: "no-validation",
        severity: "critical",
        title: "Your idea is not checked yet",
        why: "Check it first, so you don't build something nobody wants.",
        resolveTo: "/app/outcomes/build",
        resolveLabel: "Check my idea",
        estimatedMinutes: 8,
      });
    }
    if (!signals.hasOffer && signals.hasValidatedIdea) {
      blockers.push({
        id: "no-offer",
        severity: "critical",
        title: "You don't have an offer yet",
        why: "You can't sell anything until you can say what it is and what it costs.",
        resolveTo: "/app/outcomes/build",
        resolveLabel: "Build my offer",
        estimatedMinutes: 30,
      });
    }
    if (signals.leadCount === 0 && signals.hasOffer) {
      blockers.push({
        id: "no-leads",
        severity: "high",
        title: "No leads saved yet",
        why: "You need people to talk to. Bylda will help you find your first 10.",
        resolveTo: "/app/outcomes/launch",
        resolveLabel: "Find my first customers",
        estimatedMinutes: 15,
      });
    }
    if (signals.activeAutomationCount === 0 && signals.leadCount >= 3) {
      blockers.push({
        id: "no-automation",
        severity: "medium",
        title: "Follow-up is still by hand",
        why: "Leads go cold fast. Turn on follow-up so no one is forgotten.",
        resolveTo: "/app/automations",
        resolveLabel: "Turn on follow-up",
        estimatedMinutes: 15,
      });
    }
  } else {
    if (signals.activeAutomationCount === 0) {
      blockers.push({
        id: "no-automation",
        severity: "critical",
        title: "Nothing runs by itself yet",
        why: "Every task you do by hand eats your time. Automate one this week.",
        resolveTo: "/app/outcomes/automate",
        resolveLabel: "Automate one task",
        estimatedMinutes: 20,
      });
    }
    if (!signals.hasGtm) {
      blockers.push({
        id: "no-gtm",
        severity: "high",
        title: "Your growth plan is not written down",
        why: "If it only lives in your head, nobody can help you with it.",
        resolveTo: "/app/outcomes/optimize",
        resolveLabel: "Write the plan",
        estimatedMinutes: 30,
      });
    }
  }

  /* ── Recommendations: the next best moves, ranked ── */
  const recommendations: Recommendation[] = [];

  if (signals.recentlyGraduated) {
    recommendations.push({
      id: "explore-operator-tools",
      title: "Your business has grown — explore Operator tools",
      impact: "Bylda unlocked pipeline and team tools now that you have real clients",
      estimatedMinutes: 5,
      to: "/app/bylda/crm",
    });
  }
  if (signals.missionActive && signals.missionProgress < 1) {
    recommendations.push({
      id: "continue-mission",
      title: `Keep going: ${mission?.mission?.title ?? "your current goal"}`,
      impact: "Finishing this is your fastest win",
      estimatedMinutes: 15,
      to: "/app/mission-control",
    });
  }
  if (signals.hasOffer && !signals.hasGtm) {
    recommendations.push({
      id: "gtm",
      title: "Make your customer plan",
      impact: "Know where to find customers and what to say",
      estimatedMinutes: 10,
      to: "/app/outcomes/launch",
    });
  }
  if (signals.hasGtm && !signals.hasFollowupSequence) {
    recommendations.push({
      id: "followup",
      title: "Set up your follow-up emails",
      impact: "Most people buy after 5 to 8 reminders — never lose a warm lead",
      estimatedMinutes: 15,
      to: "/app/outcomes/launch",
    });
  }
  if (signals.toolRunCount >= 3 && signals.activeAutomationCount === 0) {
    recommendations.push({
      id: "automate",
      title: "Turn on your first automation",
      impact: "Stop doing by hand what Bylda can run for you",
      estimatedMinutes: 15,
      to: "/app/automations",
    });
  }
  if (
    signals.missionActive &&
    signals.daysSinceLastStepCompleted !== null &&
    signals.daysSinceLastStepCompleted >= 3
  ) {
    recommendations.push({
      id: "resume-momentum",
      title: `Pick up where you left off: ${mission?.mission?.title ?? "your mission"}`,
      impact: "You're partway there — finishing beats starting something new",
      estimatedMinutes: 15,
      to: "/app/mission-control",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "ask-bylda",
      title: "Ask Bylda what to do next",
      impact: "Bylda looks at your business and picks your next move",
      estimatedMinutes: 2,
      to: "/app/mentor",
    });
  }

  return {
    isLoading,
    mode,
    stage,
    businessName: org?.name || "Your Business",
    goal: org?.goal || "",
    metrics,
    blockers: blockers.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    leads: leads as LeadRow[],
    signals,
  };
}
