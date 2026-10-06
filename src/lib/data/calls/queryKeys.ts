import type { CallFilter } from "../types";

export const callKeys = {
  all: ["calls"] as const,
  list: (f: CallFilter) => ["calls", "list", f] as const,
  mine: () => ["calls", "mine"] as const,
  review: (id: string) => ["calls", "review", id] as const,
  savedViews: () => ["calls", "saved-views"] as const,
  compare: (a: string, b: string) => ["calls", "compare", a, b] as const,
  events: (id: string) => ["calls", "events", id] as const,
};
