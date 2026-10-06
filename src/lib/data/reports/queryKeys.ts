export const reportKeys = {
  list: () => ["reports", "list"] as const,
  brief: (id: string) => ["reports", "brief", id] as const,
};
