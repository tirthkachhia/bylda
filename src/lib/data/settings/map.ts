import type {
  AnalysisPreferences,
  ApiKey,
  NotificationPreferences,
  RetentionPolicy,
} from "../types";

/** C-26 · proposed workspace_settings row (one per workspace). */
export type SettingsRow = {
  workspace_id: string;
  timezone: string;
  week_starts_on: "monday" | "sunday";
  min_call_seconds: number;
  exclude_internal_calls: boolean;
  languages: string[];
  redact_pii: boolean;
  recordings_retention_days: number;
  transcripts_retention_days: number;
  delete_on_request: boolean;
};
export const mapAnalysisPrefs = (r: SettingsRow): AnalysisPreferences => ({
  minCallSeconds: r.min_call_seconds,
  excludeInternalCalls: r.exclude_internal_calls,
  languages: r.languages,
  redactPii: r.redact_pii,
});
export const mapRetention = (r: SettingsRow): RetentionPolicy => ({
  recordingsDays: r.recordings_retention_days,
  transcriptsDays: r.transcripts_retention_days,
  deleteOnRequest: r.delete_on_request,
});
export type NotificationPrefsRow = {
  user_id: string;
  channel: NotificationPreferences["channel"];
  types: Record<string, boolean>;
  quiet_from: string | null;
  quiet_to: string | null;
};
export const mapNotificationPrefs = (r: NotificationPrefsRow): NotificationPreferences => ({
  channel: r.channel,
  types: r.types,
  quietHours: r.quiet_from && r.quiet_to ? { from: r.quiet_from, to: r.quiet_to } : null,
});

/** C-29 · proposed api_keys row (the secret is shown once at creation, never stored in clear). */
export type ApiKeyRow = {
  id: string;
  organization_id: string;
  label: string;
  last4: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
};
export const mapApiKey = (r: ApiKeyRow): ApiKey => ({
  id: r.id,
  label: r.label,
  last4: r.last4,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
  scopes: r.scopes ?? [],
});
