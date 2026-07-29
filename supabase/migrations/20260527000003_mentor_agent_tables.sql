-- ════════════════════════════════════════════════════════════════════
-- Nova Launchpad · Mentor Agent Tables
-- Adds tables for the AI Mentorship Mission Control feature.
-- All statements are idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
-- mentor_agent_sessions: persists chat conversations between a user and each AI mentor agent.
-- mentor_insights: stores AI-generated insights/signals per org, populated by n8n workflows.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. mentor_agent_sessions ──────────────────────────────────────────
-- One row per (org, agent) pair. Stores the full message history as JSONB.
-- session_key is a generated column for convenient lookups without a composite index.
create table if not exists public.mentor_agent_sessions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  agent_id    text not null,  -- 'growth' | 'offer' | 'sales' | 'content' | 'automation' | 'finance'
  messages    jsonb not null default '[]',  -- [{role:'user'|'agent', text:string, ts:string}]
  session_key text generated always as (org_id::text || ':' || agent_id) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint mentor_agent_sessions_org_agent_key unique (org_id, agent_id)
);
alter table public.mentor_agent_sessions enable row level security;
drop trigger if exists trg_mentor_agent_sessions_updated on public.mentor_agent_sessions;
create trigger trg_mentor_agent_sessions_updated
  before update on public.mentor_agent_sessions
  for each row execute function public.set_updated_at();
create index if not exists idx_mentor_agent_sessions_org_id   on public.mentor_agent_sessions(org_id);
create index if not exists idx_mentor_agent_sessions_user_id  on public.mentor_agent_sessions(user_id);
create index if not exists idx_mentor_agent_sessions_agent_id on public.mentor_agent_sessions(agent_id);
create index if not exists idx_mentor_agent_sessions_org_agent on public.mentor_agent_sessions(org_id, agent_id);

-- ── 2. mentor_insights ────────────────────────────────────────────────
-- Append-style signal/opportunity rows produced by n8n workflows.
-- Service role writes; authenticated users read their org's rows.
create table if not exists public.mentor_insights (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  agent_id   text not null,
  type       text not null,        -- 'signal' | 'opportunity' | 'warning' | 'recommendation'
  title      text not null,
  detail     text not null,
  priority   text not null default 'medium',  -- 'high' | 'medium' | 'low'
  read       boolean not null default false,
  n8n_run_id text,                 -- traceability back to the n8n execution that created this
  created_at timestamptz not null default now()
);
alter table public.mentor_insights enable row level security;
create index if not exists idx_mentor_insights_org_id   on public.mentor_insights(org_id);
create index if not exists idx_mentor_insights_agent_id on public.mentor_insights(agent_id);
create index if not exists idx_mentor_insights_org_agent on public.mentor_insights(org_id, agent_id);

-- ── 3. RLS Policies ───────────────────────────────────────────────────

-- mentor_agent_sessions: the owning user can select/insert/update/delete their own rows
drop policy if exists "mentor_agent_sessions_select_own" on public.mentor_agent_sessions;
create policy "mentor_agent_sessions_select_own"
  on public.mentor_agent_sessions for select
  using (user_id = auth.uid());

drop policy if exists "mentor_agent_sessions_insert_own" on public.mentor_agent_sessions;
create policy "mentor_agent_sessions_insert_own"
  on public.mentor_agent_sessions for insert
  with check (user_id = auth.uid());

drop policy if exists "mentor_agent_sessions_update_own" on public.mentor_agent_sessions;
create policy "mentor_agent_sessions_update_own"
  on public.mentor_agent_sessions for update
  using (user_id = auth.uid());

drop policy if exists "mentor_agent_sessions_delete_own" on public.mentor_agent_sessions;
create policy "mentor_agent_sessions_delete_own"
  on public.mentor_agent_sessions for delete
  using (user_id = auth.uid());

-- mentor_insights: org members can read insights for their org
drop policy if exists "mentor_insights_select_org_member" on public.mentor_insights;
create policy "mentor_insights_select_org_member"
  on public.mentor_insights for select
  using (
    org_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- mentor_insights: insert/update are service-role only (created by n8n backend)
drop policy if exists "mentor_insights_no_client_insert" on public.mentor_insights;
create policy "mentor_insights_no_client_insert"
  on public.mentor_insights for insert
  with check (false);  -- service role bypasses RLS

drop policy if exists "mentor_insights_no_client_update" on public.mentor_insights;
create policy "mentor_insights_no_client_update"
  on public.mentor_insights for update
  using (false);  -- service role bypasses RLS
