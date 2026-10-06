import type { Source } from "../core/source";
/**
 * hybrid — REAL: profile (profiles), members (list_org_members), workspace name
 * (workspaces), audit log (admin_audit_log). MISSING (C-26): analysis preferences,
 * notification preferences, retention policy, API keys, timezone / week start.
 */
export const SOURCE: Source = "hybrid";
export const PREFS_SOURCE: Source = "mock";
