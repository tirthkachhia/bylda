-- Phase 4 (AI context): memory upgrades.
--
-- 1. memory_artifacts.content — store the FULL tool output, not just the
--    500-char preview. The context assembler injects prior outputs into
--    subsequent tool prompts; previews are too thin to chain reasoning on.
--    content_preview stays as the cheap listing payload.

-- Create table if it doesn't exist (ensures idempotency across new preview branches)
create table if not exists public.memory_artifacts (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  source_label    text        not null,
  content_preview text,
  created_at      timestamptz not null default now()
);

alter table public.memory_artifacts
  add column if not exists content text;

comment on column public.memory_artifacts.content is
  'Full artifact body (e.g. complete tool output JSON/markdown). content_preview remains the truncated listing payload.';

-- 2. Index for the assembler's hot path: latest related outputs per org.
create index if not exists idx_memory_artifacts_org_label_created
  on public.memory_artifacts (org_id, source_label, created_at desc);
