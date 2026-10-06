import type { Source } from "../core/source";
/**
 * mock — insights + home feed MISSING (C-03, C-04). H7 workspace health is hybrid:
 * health_checks / failed_jobs / usage are REAL (GAPS 05 admin rows AVAILABLE).
 */
export const SOURCE: Source = "mock";
export const HEALTH_SOURCE: Source = "hybrid";
