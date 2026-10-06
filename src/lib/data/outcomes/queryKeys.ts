export const outcomeKeys = {
  list: (behaviorKey?: string) => ["outcomes", behaviorKey ?? "all"] as const,
};
