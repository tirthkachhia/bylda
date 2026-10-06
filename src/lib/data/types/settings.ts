import type { ID, ISODate } from "./common";
import type { Behavior } from "./behavior";
import type { Role } from "./session";

export type WorkspaceSettings = {
  id: ID;
  name: string;
  timezone: string;
  weekStartsOn: "monday" | "sunday";
  defaultTeamId: ID | null;
};
export type Profile = {
  id: ID;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  title: string | null;
};
export type Member = {
  id: ID;
  name: string;
  email: string | null;
  role: Role;
  teamId: ID | null;
  status: "active" | "invited" | "disabled";
};
export type RoleDefinition = {
  role: Role;
  name: string;
  description: string;
  permissions: string[];
};

export type AnalysisPreferences = {
  minCallSeconds: number;
  excludeInternalCalls: boolean;
  languages: string[];
  redactPii: boolean;
};
export type NotificationPreferences = {
  channel: "in_app" | "email" | "slack";
  types: Record<string, boolean>;
  quietHours: { from: string; to: string } | null;
};
export type RetentionPolicy = {
  recordingsDays: number;
  transcriptsDays: number;
  deleteOnRequest: boolean;
};
export type ApiKey = {
  id: ID;
  label: string;
  last4: string;
  createdAt: ISODate;
  lastUsedAt: ISODate | null;
  scopes: string[];
};
export type AuditEntry = {
  id: ID;
  actorName: string;
  action: string;
  entity: string;
  createdAt: ISODate;
};

/** 16 Methodology (E9–E14). */
export type MethodologyStage = { key: string; name: string; order: number; exitCriteria: string[] };
export type Methodology = {
  id: ID;
  name: string;
  template: "meddic" | "spin" | "challenger" | "sandler" | "bant" | "custom";
  stages: MethodologyStage[];
  behaviors: Behavior[];
  isActive: boolean;
};
export type ObjectionLibraryItem = {
  id: ID;
  label: string;
  category: string;
  recommendedResponse: string;
  seenCount: number;
};
export type SuccessCriterion = {
  id: ID;
  outcome: "next_step_booked" | "stage_advanced" | "closed_won_lost" | "meeting_held";
  enabled: boolean;
  source: "call" | "crm";
};
