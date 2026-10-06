export const teamKeys = {
  team: (id: string) => ["team", id] as const,
  members: (teamId: string | null) => ["team", "members", teamId] as const,
  rep: (id: string) => ["team", "rep", id] as const,
  compare: (teamId: string) => ["team", "compare", teamId] as const,
  repHome: () => ["team", "rep-home"] as const,
  progress: () => ["team", "my-progress"] as const,
};
