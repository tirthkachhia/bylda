export const behaviorKeys = {
  list: () => ["behaviors", "list"] as const,
  team: () => ["behaviors", "team"] as const,
  detail: (key: string) => ["behaviors", "detail", key] as const,
  scores: (subject: string) => ["behaviors", "scores", subject] as const,
  patterns: (scope: string) => ["behaviors", "patterns", scope] as const,
  objections: () => ["behaviors", "objections"] as const,
};
