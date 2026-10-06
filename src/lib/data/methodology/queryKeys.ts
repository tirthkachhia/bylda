export const methodologyKeys = {
  list: () => ["methodology", "list"] as const,
  one: (id: string) => ["methodology", "one", id] as const,
  objections: () => ["methodology", "objections"] as const,
  criteria: () => ["methodology", "criteria"] as const,
};
