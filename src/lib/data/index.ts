/**
 * @/lib/data — the ONLY data import surface for V1 screens (CLAUDE.md §5).
 * Every hook: TanStack Query result + `isEmpty`, same shape in mock / real / hybrid.
 * Docs: src/lib/data/README.md.
 */
export type * from "./types";
export {
  OUTCOME_MIN_CLOSED,
  isOutcomeSufficient,
  REP_INSIGHT_MIN_CALLS,
  TEAM_PATTERN_MIN_CALLS,
  gateInsight,
  insightMinCalls,
  insightScope,
  isInsightSufficient,
  patternShowsConfidence,
} from "./types";

export { mocksForced, resolveSource, setSourceOverride, type Source } from "./core/source";
export { NotBuiltError, ForbiddenForRoleError, isNotBuilt } from "./core/errors";
export { DEV_ROLES, setDevRole, useDevRole } from "./core/devRole";
export type { DataCtx } from "./core/context";
export type { DataResult } from "./core/query";

export { useViewer, useDataCtx, useWorkspaces, useTeams } from "./session/hooks";
export { useSidebar, useHasUnread } from "./shell/hooks";
export type { SidebarData } from "./shell/map";

// ── Domains ──────────────────────────────────────────────────────────────────
export { useAuthActions } from "./auth/hooks";
export { useOnboarding, useSaveOnboarding } from "./onboarding/hooks";
export { useInsights, useHomeFeed, useWorkspaceHealth, type InsightFilter } from "./insights/hooks";
export {
  useCalls,
  useMyCalls,
  useCallReview,
  useSavedViews,
  useCallComparison,
  useBehavioralEvents,
  useUploadCall,
  useReanalyzeCall,
} from "./calls/hooks";
export {
  useBehaviors,
  useBehaviorDetail,
  useTeamBehaviors,
  useRepScores,
  usePatterns,
  useObjectionStats,
} from "./behaviors/hooks";
export { useOutcomeAssociations } from "./outcomes/hooks";
export {
  useCoachingFoci,
  useMyCoaching,
  useCoachingFocus,
  useCoachingComments,
  useAssignCoaching,
  useAcknowledgeCoaching,
  type CoachingFilter,
} from "./coaching/hooks";
export {
  useTeam,
  useTeamMembers,
  useRepSummary,
  useRepComparison,
  useRepHome,
  useMyProgress,
  type RepHome,
  type MyProgress,
} from "./team/hooks";
export { useReports, useBrief } from "./reports/hooks";
export {
  useRooms,
  useRoom,
  useRoomMessages,
  useRoomInsights,
  useDmThreads,
  useDmMessages,
} from "./rooms/hooks";
export {
  useNotifications,
  useMarkNotificationRead,
  usePushRegistration,
} from "./notifications/hooks";
export { useSearch, usePaletteItems } from "./search/hooks";
export {
  useDataSources,
  useDeliveryChannels,
  useIntegrationDetail,
  useConnectSource,
} from "./integrations/hooks";
export {
  useWorkspaceSettings,
  useProfile,
  useMembers,
  useRoleDefinitions,
  useAnalysisPreferences,
  useNotificationPreferences,
  useRetentionPolicy,
  useApiKeys,
  useAuditLog,
  useInviteMembers,
} from "./settings/hooks";
export {
  useMethodologies,
  useMethodology,
  useObjectionLibrary,
  useSuccessCriteria,
} from "./methodology/hooks";
export { usePlan, useInvoices, useUsage } from "./billing/hooks";
