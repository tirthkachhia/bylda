import { useMutation } from "@tanstack/react-query";
import { assertNotRep, type DataCtx } from "../core/context";
import { useCtxQuery } from "../core/hook";
import { isEmptyArray, never } from "../core/query";
import { resolveSource } from "../core/source";
import {
  API_KEYS,
  ANALYSIS_PREFS,
  AUDIT,
  MEMBERS,
  NOTIFICATION_PREFS,
  RETENTION,
  ROLE_DEFINITIONS,
  WORKSPACE_SETTINGS,
} from "../mocks/admin";
import { personById } from "../mocks/people";
import { loadTeamMembers } from "../team/hooks";
import { useDataCtx } from "../session/hooks";
import type {
  AnalysisPreferences,
  ApiKey,
  AuditEntry,
  Member,
  NotificationPreferences,
  Profile,
  RetentionPolicy,
  RoleDefinition,
  WorkspaceSettings,
} from "../types";
import { fetchAudit, fetchProfile, fetchWorkspaceSettingsRow, inviteMember } from "./fetchers";
import { mapAnalysisPrefs, mapRetention } from "./map";
import { settingsKeys } from "./queryKeys";
import { PREFS_SOURCE, SOURCE } from "./source";

const mock = () => resolveSource(SOURCE) === "mock";
const prefsMock = () => resolveSource(PREFS_SOURCE) === "mock";

export async function loadWorkspaceSettings(ctx: DataCtx): Promise<WorkspaceSettings> {
  if (mock()) return WORKSPACE_SETTINGS;
  // GAP: timezone / week start / default team — C-26
  return {
    id: ctx.workspaceId ?? "",
    name: ctx.workspaceId ? "Workspace" : "",
    timezone: "UTC",
    weekStartsOn: "monday",
    defaultTeamId: null,
  };
}
export async function loadProfile(ctx: DataCtx): Promise<Profile> {
  if (mock()) {
    const p = personById(ctx.userId);
    return {
      id: ctx.userId,
      name: p?.name ?? "",
      email: `${p?.firstName.toLowerCase()}@acme-revenue.test`,
      avatarUrl: null,
      title: p?.title ?? null,
    };
  }
  const r = await fetchProfile(ctx.userId);
  return {
    id: r.id,
    name: r.full_name ?? "",
    email: r.email,
    avatarUrl: r.avatar_url,
    title: null,
  };
}
/** E3 — managers/admins only. */
export async function loadMembers(ctx: DataCtx): Promise<Member[]> {
  assertNotRep(ctx, "the member list");
  if (mock()) return MEMBERS;
  return (await loadTeamMembers(ctx, null)).map((p) => ({
    id: p.id,
    name: p.name,
    email: null,
    role: p.role,
    teamId: p.teamId,
    status: "active" as const,
  }));
}
/** E5 — the V1 role model is a frontend constant (not backend data). */
export const loadRoleDefinitions = async (): Promise<RoleDefinition[]> => ROLE_DEFINITIONS;
export async function loadAnalysisPreferences(ctx: DataCtx): Promise<AnalysisPreferences> {
  void ctx;
  return prefsMock() ? ANALYSIS_PREFS : mapAnalysisPrefs(await fetchWorkspaceSettingsRow());
}
export async function loadNotificationPreferences(ctx: DataCtx): Promise<NotificationPreferences> {
  void ctx;
  // GAP: notification_preferences — C-26
  return NOTIFICATION_PREFS;
}
export async function loadRetentionPolicy(ctx: DataCtx): Promise<RetentionPolicy> {
  void ctx;
  return prefsMock() ? RETENTION : mapRetention(await fetchWorkspaceSettingsRow());
}
export async function loadApiKeys(ctx: DataCtx): Promise<ApiKey[]> {
  assertNotRep(ctx, "API keys");
  // GAP: api_keys — C-26
  return API_KEYS;
}
export async function loadAuditLog(ctx: DataCtx): Promise<AuditEntry[]> {
  assertNotRep(ctx, "the audit log");
  if (mock()) return AUDIT;
  return (await fetchAudit()).map((r) => ({
    id: r.id,
    actorName: r.email ?? "—",
    action: r.event_type,
    entity: "",
    createdAt: r.created_at,
  }));
}

export const useWorkspaceSettings = () =>
  useCtxQuery(settingsKeys.workspace(), loadWorkspaceSettings, never);
export const useProfile = () => useCtxQuery(settingsKeys.profile(), loadProfile, never);
export const useMembers = () => useCtxQuery(settingsKeys.members(), loadMembers, isEmptyArray);
export const useRoleDefinitions = () =>
  useCtxQuery(settingsKeys.roles(), loadRoleDefinitions, isEmptyArray);
export const useAnalysisPreferences = () =>
  useCtxQuery(settingsKeys.analysis(), loadAnalysisPreferences, never);
export const useNotificationPreferences = () =>
  useCtxQuery(settingsKeys.notifications(), loadNotificationPreferences, never);
export const useRetentionPolicy = () =>
  useCtxQuery(settingsKeys.retention(), loadRetentionPolicy, never);
export const useApiKeys = () => useCtxQuery(settingsKeys.apiKeys(), loadApiKeys, isEmptyArray);
export const useAuditLog = () => useCtxQuery(settingsKeys.audit(), loadAuditLog, isEmptyArray);

/** E3/A9 — invite by email (team-invite edge fn). Mock resolves. */
export function useInviteMembers() {
  const ctx = useDataCtx();
  return useMutation<unknown, Error, { emails: string[]; role: string }>({
    mutationFn: async ({ emails, role }) => {
      if (ctx) assertNotRep(ctx, "inviting members");
      if (mock()) return { invited: emails.length };
      return Promise.all(emails.map((e) => inviteMember(e, role)));
    },
  });
}
