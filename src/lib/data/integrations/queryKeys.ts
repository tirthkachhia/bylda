export const integrationKeys = {
  sources: () => ["integrations", "sources"] as const,
  channels: () => ["integrations", "channels"] as const,
  detail: (key: string) => ["integrations", "detail", key] as const,
};
