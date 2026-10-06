import type { ID } from "./common";

/** 04 Onboarding state + H7 Admin Home workspace health. */
export type OnboardingState = {
  step: "workspace" | "teach" | "connect" | "invite" | "analysis" | "first_insight" | "done";
  workspaceName: string | null;
  methodologyTemplate: string | null;
  connectedSources: string[];
  invitedCount: number;
  analysis: { analyzed: number; total: number; etaMinutes: number | null };
};

export type WorkspaceHealth = {
  sources: { key: string; name: string; status: "ok" | "degraded" | "down" }[];
  failedJobs: number;
  callsAnalyzedThisWeek: number;
  seats: { used: number; total: number | null };
  alerts: { id: ID; title: string; severity: "attention" | "regress" }[];
};
