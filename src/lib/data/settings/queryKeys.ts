export const settingsKeys = {
  workspace: () => ["settings", "workspace"] as const,
  profile: () => ["settings", "profile"] as const,
  members: () => ["settings", "members"] as const,
  roles: () => ["settings", "roles"] as const,
  analysis: () => ["settings", "analysis"] as const,
  notifications: () => ["settings", "notifications"] as const,
  retention: () => ["settings", "retention"] as const,
  apiKeys: () => ["settings", "api-keys"] as const,
  audit: () => ["settings", "audit"] as const,
};
