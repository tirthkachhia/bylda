/**
 * Where a domain's data comes from.
 *   mock   — fixtures only (src/lib/data/mocks)
 *   real   — Supabase / edge functions only
 *   hybrid — real where GAPS.md says AVAILABLE, mock merged in where MISSING (// GAP:)
 *
 * VITE_BYLDA_MOCKS=true forces every domain to 'mock' regardless of its SOURCE.
 */
export type Source = "mock" | "real" | "hybrid";

let override: Source | null = null;

/** Tests only — force every domain to one mode. `null` restores normal resolution. */
export function setSourceOverride(source: Source | null) {
  override = source;
}

export function mocksForced(): boolean {
  if (override) return override === "mock";
  return import.meta.env.VITE_BYLDA_MOCKS === "true";
}

export function resolveSource(declared: Source): Source {
  if (override) return override;
  // Fixtures require explicit demo mode. Missing domains use their real fetcher,
  // which reports NotBuiltError instead of presenting sample data as live data.
  return mocksForced() ? "mock" : declared === "mock" ? "real" : declared;
}
