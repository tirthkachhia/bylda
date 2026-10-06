export const searchKeys = {
  search: (q: string, days: number) => ["search", q, days] as const,
  palette: (q: string) => ["search", "palette", q] as const,
};
