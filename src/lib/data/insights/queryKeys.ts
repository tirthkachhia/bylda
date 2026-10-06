export const insightKeys = {
  list: (f: object) => ["insights", "list", f] as const,
  feed: (tab: string) => ["insights", "feed", tab] as const,
  health: () => ["insights", "workspace-health"] as const,
};
