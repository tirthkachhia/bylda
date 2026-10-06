import type { Source } from "../core/source";
/**
 * hybrid — REAL: notifications (id, message, read, type, created_at, user_id).
 * MISSING: V1 type enum, severity, title/body split, href (C-22).
 */
export const SOURCE: Source = "hybrid";
