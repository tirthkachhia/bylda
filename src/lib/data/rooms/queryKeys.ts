export const roomKeys = {
  list: () => ["rooms", "list"] as const,
  one: (id: string) => ["rooms", "one", id] as const,
  messages: (id: string) => ["rooms", "messages", id] as const,
  dms: () => ["rooms", "dms"] as const,
  dmMessages: (id: string) => ["rooms", "dm-messages", id] as const,
  insights: (id: string) => ["rooms", "insights", id] as const,
};
