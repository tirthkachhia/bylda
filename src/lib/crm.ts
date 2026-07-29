/**
 * crm.ts — typed client wrappers for the CRM edge functions (crm-action,
 * crm-dedupe, crm-merge). Keeps route components free of raw invokeEdge plumbing
 * and centralises the payload shapes the functions expect.
 */
import { invokeEdge } from "@/lib/invokeEdge";

export type CrmEntityType = "contact" | "company";

export interface CreateLeadInput {
  name: string;
  stage?: string;
  source?: string;
  notes?: string;
  value?: number;
  email?: string;
  phone?: string;
  company?: string;
  domain?: string;
  website?: string;
  contact_first_name?: string;
  contact_last_name?: string;
}

/** Create a deal wired to a deduped contact + company, logged on the timeline. */
export function createLead(orgId: string, payload: CreateLeadInput) {
  return invokeEdge<{ ok: boolean; result: { id: string } }>("crm-action", {
    action: "create_lead",
    org_id: orgId,
    payload,
  });
}

export interface CreateCompanyInput {
  name?: string;
  domain?: string;
  website?: string;
  industry?: string;
  size?: string;
  location?: string;
}

/** Create-or-match a company (dedupes by domain, then name). */
export function createCompany(orgId: string, payload: CreateCompanyInput) {
  return invokeEdge<{ ok: boolean; result: { id: string; created: boolean } }>("crm-action", {
    action: "create_company",
    org_id: orgId,
    payload,
  });
}

export interface CreateContactInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  domain?: string;
  source?: string;
  tags?: string[];
}

/** Create-or-match a contact (dedupes by email, then name; links company). */
export function createContact(orgId: string, payload: CreateContactInput) {
  return invokeEdge<{ ok: boolean; result: { id: string; created: boolean } }>("crm-action", {
    action: "create_contact",
    org_id: orgId,
    payload,
  });
}

/** Scan one record (or the whole org) for duplicates into the dedupe queue. */
export function dedupeScan(
  orgId: string,
  entityType: CrmEntityType,
  opts: { entityId?: string; all?: boolean },
) {
  return invokeEdge<{ ok: boolean; scanned: number }>("crm-dedupe", {
    org_id: orgId,
    entity_type: entityType,
    entity_id: opts.entityId,
    scan: opts.all ? "all" : undefined,
  });
}

/** Merge two records — every FK reassigns to the winner; the loser is archived. */
export function mergeRecords(
  orgId: string,
  entityType: CrmEntityType,
  winnerId: string,
  loserId: string,
) {
  return invokeEdge<{ ok: boolean }>("crm-merge", {
    org_id: orgId,
    entity_type: entityType,
    winner_id: winnerId,
    loser_id: loserId,
  });
}

/** Refresh Mo Latif's stalled-deal + time-in-stage signals for the org. */
export function refreshPipelineInsights(orgId: string) {
  return invokeEdge<{ ok: boolean; insights_written: number }>("crm-insights", {
    org_id: orgId,
  });
}

/**
 * Drain due sequence steps for the org now (the cron does this every 15 min;
 * this lets the UI kick it on demand, e.g. right after enrolling a contact).
 */
export function runSequences(orgId: string) {
  return invokeEdge<{ ok: boolean; processed: number; advanced: number; completed: number }>(
    "sequence-runner",
    { org_id: orgId },
  );
}

/** Snapshot the org's forecast by category and refresh Dhruv's verdict. */
export function refreshForecast(orgId: string) {
  return invokeEdge<{ ok: boolean; period: string }>("forecast-rollup", { org_id: orgId });
}

/** Recompute customer health / churn risk for the org's accounts. */
export function refreshCustomerHealth(orgId: string) {
  return invokeEdge<{ ok: boolean; accounts_scored: number }>("cs-health", { org_id: orgId });
}

/** Link leads to campaigns by UTM and credit won-deal revenue. */
export function refreshAttribution(orgId: string) {
  return invokeEdge<{ ok: boolean; leads_attributed: number }>("marketing-attribution", {
    org_id: orgId,
  });
}

/** Compile a visual workflow_definitions graph into an executable workflow. */
export function compileWorkflow(definitionId: string) {
  return invokeEdge<{ ok: boolean; workflow_id: string; steps: number }>("compile-workflow", {
    definition_id: definitionId,
  });
}

export type NextBestAction = {
  kind: string;
  title: string;
  detail: string;
  score: number;
  entity_type: string;
  entity_id: string;
};

/** Unified copilot: ranked next-best actions across the whole CRM. */
export function nextBestActions(orgId: string, persist = false) {
  return invokeEdge<{ ok: boolean; actions: NextBestAction[] }>("next-best-action", {
    org_id: orgId,
    persist,
  });
}

/** Run conversation intelligence on a call that already has a transcript. */
export function analyzeCall(callId: string) {
  return invokeEdge<{
    ok: boolean;
    objections: number;
    competitor_mentions: number;
    next_steps: number;
    talk_ratio: number | null;
    sentiment_score: number | null;
  }>("analyze-call", { call_id: callId });
}
