export const CONTEXT_PACKAGE_VERSION = "1.0" as const;

export type ContextEntityType = "organization" | "company" | "contact" | "lead" | "call" | "user";

export interface EntityRef {
  type: ContextEntityType;
  id: string;
}

export interface SourceReference {
  id: string;
  type: string;
  entity?: EntityRef;
  occurred_at?: string | null;
  label?: string;
}

export interface EvidenceItem {
  id: string;
  source_type: string;
  source_id?: string | null;
  content: string;
  occurred_at?: string | null;
  similarity?: number | null;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface ContextReceipt {
  context_version: number;
  package_version: typeof CONTEXT_PACKAGE_VERSION;
  generated_at: string;
  source_references: SourceReference[];
  omissions: string[];
  token_estimate: number;
}

export interface ContextPackage {
  package_version: typeof CONTEXT_PACKAGE_VERSION;
  task: string;
  organization_id: string;
  entity: EntityRef | null;
  business: {
    context_version: number | null;
    profile: Record<string, unknown>;
    sales_baseline: Record<string, unknown>;
    baseline_version: number | null;
  };
  user: {
    id: string | null;
    role: string | null;
  };
  account: Record<string, unknown> | null;
  deal: Record<string, unknown> | null;
  contacts: Array<Record<string, unknown>>;
  current_state: {
    memory_facts: Array<Record<string, unknown>>;
    call: Record<string, unknown> | null;
  };
  recent_activity: Array<Record<string, unknown>>;
  relevant_history: EvidenceItem[];
  playbooks: unknown[];
  rules: unknown[];
  retrieved_evidence: EvidenceItem[];
  permissions: {
    can_read: boolean;
    can_write: boolean;
    can_manage_context: boolean;
  };
  receipt: ContextReceipt;
}

export interface RankedEvidenceResult {
  included: EvidenceItem[];
  omitted: string[];
  tokenEstimate: number;
}

export function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export function compactContextValue(
  value: unknown,
  options: {
    maxStringChars?: number;
    maxArrayItems?: number;
    maxObjectKeys?: number;
    maxDepth?: number;
  } = {},
  depth = 0,
): unknown {
  const maxStringChars = Math.max(40, options.maxStringChars ?? 800);
  const maxArrayItems = Math.max(1, options.maxArrayItems ?? 20);
  const maxObjectKeys = Math.max(1, options.maxObjectKeys ?? 50);
  const maxDepth = Math.max(1, options.maxDepth ?? 6);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length > maxStringChars ? `${value.slice(0, maxStringChars - 1)}…` : value;
  }
  if (depth >= maxDepth) return "[depth-limited]";
  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((item) => compactContextValue(item, options, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, maxObjectKeys)
        .map(([key, item]) => [key, compactContextValue(item, options, depth + 1)]),
    );
  }
  return String(value);
}

export function splitContextText(
  content: string,
  options: { maxChars?: number; overlapChars?: number } = {},
): string[] {
  const maxChars = Math.max(500, options.maxChars ?? 5000);
  const overlapChars = Math.min(Math.max(0, options.overlapChars ?? 300), maxChars - 1);
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxChars);
    if (end < normalized.length) {
      const paragraph = normalized.lastIndexOf("\n\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      const boundary = Math.max(paragraph, sentence);
      if (boundary > start + Math.floor(maxChars * 0.6)) {
        end = boundary + (boundary === sentence ? 1 : 0);
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlapChars);
  }
  return chunks;
}

function evidenceScore(item: EvidenceItem, now: number): number {
  const similarity = typeof item.similarity === "number" ? item.similarity : 0;
  const importance = typeof item.importance === "number" ? item.importance : 0.5;
  const occurredAt = item.occurred_at ? new Date(item.occurred_at).getTime() : 0;
  const ageDays = occurredAt > 0 ? Math.max(0, (now - occurredAt) / 86_400_000) : 365;
  const recency = 1 / (1 + ageDays / 30);
  return similarity * 0.5 + importance * 0.3 + recency * 0.2;
}

export function rankAndBudgetEvidence(
  items: EvidenceItem[],
  tokenBudget: number,
  reservedTokens = 0,
  now = Date.now(),
): RankedEvidenceResult {
  const available = Math.max(0, tokenBudget - reservedTokens);
  const unique = new Map<string, EvidenceItem>();
  for (const item of items) {
    const content = item.content.trim();
    if (!content) continue;
    const key = `${item.source_type}:${item.source_id ?? item.id}:${content.slice(0, 120)}`;
    if (!unique.has(key)) unique.set(key, { ...item, content });
  }

  const ordered = [...unique.values()].sort(
    (left, right) => evidenceScore(right, now) - evidenceScore(left, now),
  );
  const included: EvidenceItem[] = [];
  const omitted: string[] = [];
  let tokenEstimate = 0;

  for (const item of ordered) {
    const itemTokens = estimateTokens(item.content);
    if (tokenEstimate + itemTokens <= available) {
      included.push(item);
      tokenEstimate += itemTokens;
    } else {
      omitted.push(`${item.source_type}:${item.source_id ?? item.id}:token_budget`);
    }
  }
  return { included, omitted, tokenEstimate };
}
