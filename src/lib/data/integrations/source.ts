import type { Source } from "../core/source";
/**
 * hybrid — REAL: user_integrations_masked (connected / status / last update) + the
 * existing OAuth/save wrappers. MISSING: category, calls synced, waiting backlog (C-23b),
 * delivery channels (C-23), HubSpot field mapping state (C-27).
 */
export const SOURCE: Source = "hybrid";
export const CHANNELS_SOURCE: Source = "mock";
