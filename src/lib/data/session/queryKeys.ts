export const sessionKeys = {
  all: ["session"] as const,
  viewer: (mode: string, who: string | null, devRole: string | null) =>
    ["session", "viewer", mode, who, devRole] as const,
  workspaces: (who: string) => ["session", "workspaces", who] as const,
  teams: (orgId: string | null) => ["session", "teams", orgId] as const,
};
