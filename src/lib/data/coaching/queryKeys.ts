export const coachingKeys = {
  all: ["coaching"] as const,
  list: (f: object) => ["coaching", "list", f] as const,
  mine: () => ["coaching", "mine"] as const,
  one: (id: string) => ["coaching", "one", id] as const,
  comments: (id: string) => ["coaching", "comments", id] as const,
};
