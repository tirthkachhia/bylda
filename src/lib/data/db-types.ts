/**
 * TEMP — row types for tables that exist in supabase/migrations but are missing from
 * the stale src/integrations/supabase/types.ts (CLAUDE.md §12 C). Derived by READING
 * the migrations (file named on each type). Delete this file when Tirth regenerates
 * types.ts (BACKEND_BACKLOG.md item 2) and import from the generated Database type.
 */
type uuid = string;
type timestamptz = string;
type jsonb = unknown;

// ── The 16 queried tables missing from types.ts (AUDIT.md) ──────────────────

/** 20260719000006_crm_phase4_calling.sql */
export type CallRow = {
  id: uuid;
  organization_id: uuid;
  contact_id: uuid | null;
  lead_id: uuid | null;
  user_id: uuid | null;
  direction: "inbound" | "outbound";
  status: "queued" | "ringing" | "in_progress" | "completed" | "missed" | "voicemail" | "failed";
  duration: number | null;
  recording_url: string | null;
  disposition: string | null;
  outcome_tag: string | null;
  from_number: string | null;
  to_number: string | null;
  provider: string | null;
  provider_call_id: string | null;
  started_at: timestamptz | null;
  metadata: jsonb;
  created_at: timestamptz;
};

/** 20260719000006_crm_phase4_calling.sql */
export type CallTranscriptRow = {
  id: uuid;
  call_id: uuid;
  organization_id: uuid;
  transcript_text: string | null;
  speaker_segments: jsonb;
  sentiment_score: number | null;
  created_at: timestamptz;
};

/** 20260719000006 + 20260809000001 + 20260813000001 + 20260907000001 (writeback) */
export type CallInsightRow = {
  id: uuid;
  call_id: uuid;
  organization_id: uuid;
  objections: jsonb;
  competitor_mentions: jsonb;
  talk_ratio: number | null;
  next_steps_extracted: jsonb;
  summary: string | null;
  sales_profile: string | null;
  vertical_insights: jsonb;
  crm_writeback_preview: jsonb;
  missing_required_fields: string[] | null;
  analysis_version: number | null;
  writeback_status: string | null;
  writeback_result: jsonb;
  writeback_error: string | null;
  approved_at: timestamptz | null;
  approved_by: uuid | null;
  context_receipt: jsonb;
  context_version: string | null;
  transcript_hash: string | null;
  created_at: timestamptz;
};

/** 20260719000009_crm_phase6_customer_success.sql */
export type CustomerAccountRow = {
  id: uuid;
  organization_id: uuid;
  company_id: uuid | null;
  lead_id: uuid | null;
  name: string;
  owner_id: uuid | null;
  stage: string;
  health_score: number;
  mrr: number;
  renewal_date: string | null;
  started_at: string | null;
  churned_at: string | null;
  metadata: jsonb;
  created_at: timestamptz;
  updated_at: timestamptz;
};
/** 20260719000002_crm_phase1_core_objects.sql */
export type DuplicateMatchRow = {
  id: uuid;
  organization_id: uuid;
  entity_type: string;
  entity_id_a: uuid;
  entity_id_b: uuid;
  confidence: number;
  reason: string | null;
  status: string;
  created_at: timestamptz;
  resolved_at: timestamptz | null;
};
/** 20260701000006_campaign_events.sql */
export type CampaignEventRow = {
  id: uuid;
  organization_id: uuid;
  campaign_id: uuid;
  contact_id: uuid | null;
  type: string;
  url: string | null;
  created_at: timestamptz;
};
/** 20260711120000_waitlist_signups.sql */
export type WaitlistSignupRow = {
  id: uuid;
  name: string;
  email: string;
  segment: string | null;
  bottleneck: string | null;
  revenue: string | null;
  ref: string | null;
  page: string | null;
  status: string;
  user_id: uuid | null;
  created_at: timestamptz;
  joined_at: timestamptz | null;
};
/** 20260707000001_founder_streaks.sql */
export type FounderStreakRow = {
  organization_id: uuid;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  updated_at: timestamptz;
};
/** 20260706000002_mentor_curriculum.sql */
export type PlaybookRow = {
  id: uuid;
  organization_id: uuid;
  casefile_run_id: uuid | null;
  business_model: string;
  stage: string;
  created_at: timestamptz;
};
/** 20260706000002_mentor_curriculum.sql */
export type PlaybookLessonRow = {
  id: uuid;
  playbook_id: uuid;
  organization_id: uuid;
  mentor_id: string;
  stage: string;
  title: string;
  tool_key: string;
  output_format: string | null;
  status: string;
  position: number;
  summary: string | null;
  tool_run_id: uuid | null;
  created_at: timestamptz;
  completed_at: timestamptz | null;
};

/** 20260711000002_org_briefings.sql */
export type OrgBriefingRow = {
  id: uuid;
  org_id: uuid;
  briefing_date: string;
  alert_count: number;
  critical_loop_count: number;
  overdue_outcome_count: number;
  top_alert: jsonb;
  recommended_action: string;
  created_at: timestamptz;
};

/** 20260813000001_context_memory_mvp.sql */
export type IntegrationRawObjectRow = {
  id: uuid;
  organization_id: uuid;
  provider: string;
  external_object_type: string;
  external_object_id: string | null;
  idempotency_key: string;
  payload_hash: string;
  payload: jsonb;
  processing_status: string;
  canonical_type: string | null;
  canonical_id: uuid | null;
  error_message: string | null;
  received_at: timestamptz;
  processed_at: timestamptz | null;
  created_at: timestamptz;
};
/** 20260813000001_context_memory_mvp.sql */
export type IntegrationExternalObjectRow = {
  id: uuid;
  organization_id: uuid;
  provider: string;
  external_object_type: string;
  external_object_id: string;
  canonical_type: string;
  canonical_id: uuid;
  external_updated_at: timestamptz | null;
  sync_version: number;
  last_synced_at: timestamptz;
  metadata: jsonb;
  created_at: timestamptz;
  updated_at: timestamptz;
};
/** 20260813000001_context_memory_mvp.sql */
export type ContextPackageRunRow = {
  id: uuid;
  organization_id: uuid;
  requested_by: uuid | null;
  task: string;
  entity_type: string | null;
  entity_id: uuid | null;
  context_version: number;
  source_references: jsonb;
  omissions: jsonb;
  token_estimate: number;
  latency_ms: number;
  created_at: timestamptz;
};
/** 20260813000001_context_memory_mvp.sql */
export type ContextMemoryChunkRow = {
  id: uuid;
  organization_id: uuid;
  source_type: string;
  source_id: uuid | null;
  transcript_id: uuid | null;
  company_id: uuid | null;
  contact_id: uuid | null;
  lead_id: uuid | null;
  call_id: uuid | null;
  chunk_index: number;
  content: string;
  token_count: number | null;
  metadata: jsonb;
  embedding: string /* pgvector */ | null;
  embedding_model: string | null;
  occurred_at: timestamptz | null;
  created_at: timestamptz;
};

/** 20260516000000_squash.sql */
export type FailedJobRow = {
  id: uuid;
  user_id: uuid | null;
  session_id: uuid | null;
  tool_slug: string;
  payload: jsonb;
  reservation_id: uuid | null;
  error_message: string | null;
  retry_count: number;
  next_retry_at: timestamptz;
  status: "pending" | "retrying" | "resolved" | "dead";
  resolved_at: timestamptz | null;
  created_at: timestamptz;
};

// ── Other tables the data layer reads that are also missing from types.ts ──

/** workspace_member_roles — role is free text today; V1 contract narrows it (BACKEND_BACKLOG → roles). */
export type WorkspaceMemberRoleRow = {
  id: uuid;
  workspace_id: uuid;
  organization_id: uuid;
  user_id: uuid;
  role: string;
  created_at: timestamptz;
};

/** call_analysis_jobs — 20260805000002_universal_dialer_ingest.sql */
export type CallAnalysisJobRow = {
  id: uuid;
  organization_id: uuid;
  call_id: uuid;
  transcript_id: uuid;
  transcript_hash: string;
  analysis_version: number;
  status: "queued" | "running" | "completed" | "failed" | "superseded";
  attempt_count: number;
  error_message: string | null;
  created_at: timestamptz;
  started_at: timestamptz | null;
  completed_at: timestamptz | null;
};

/** audit_log */
export type AuditLogRow = {
  id: uuid;
  org_id: uuid | null;
  actor_id: uuid | null;
  entity_type: string;
  entity_id: uuid | null;
  action: string;
  diff: jsonb;
  created_at: timestamptz;
};
