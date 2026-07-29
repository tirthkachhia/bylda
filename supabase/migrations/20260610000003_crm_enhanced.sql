-- ── CRM Enhanced: tags, score, priority, activities, platform analytics ─────

-- 1. New columns on leads table
alter table public.leads
  add column if not exists tags        text[]    not null default '{}',
  add column if not exists score       smallint  not null default 0,
  add column if not exists priority    text      not null default 'medium',
  add column if not exists owner_name  text,
  add column if not exists custom_fields jsonb   default '{}';

alter table public.leads drop constraint if exists leads_score_check;
alter table public.leads add constraint leads_score_check check (score between 0 and 100);

alter table public.leads drop constraint if exists leads_priority_check;
alter table public.leads add constraint leads_priority_check check (priority in ('low','medium','high'));

-- 2. CRM Activities timeline
create table if not exists public.crm_activities (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null,
  deal_id         uuid        not null references public.leads(id) on delete cascade,
  user_id         uuid        references auth.users(id),
  type            text        not null check (type in ('note','stage_change','email','call','task','meeting')),
  content         text,
  metadata        jsonb       default '{}',
  created_at      timestamptz not null default now()
);

alter table public.crm_activities enable row level security;

drop policy if exists "crm_activities_select" on public.crm_activities;
create policy "crm_activities_select" on public.crm_activities
  for select using (user_id = auth.uid() or
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "crm_activities_insert" on public.crm_activities;
create policy "crm_activities_insert" on public.crm_activities
  for insert with check (user_id = auth.uid());

create index if not exists idx_crm_activities_deal on public.crm_activities(deal_id);
create index if not exists idx_crm_activities_org  on public.crm_activities(organization_id);

-- 3. Platform analytics event log (for admin hub)
create table if not exists public.platform_events (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid,
  user_id         uuid        references auth.users(id),
  event_type      text        not null,
  resource_type   text,
  resource_id     text,
  metadata        jsonb       default '{}',
  created_at      timestamptz not null default now()
);

alter table public.platform_events enable row level security;

drop policy if exists "platform_events_admin" on public.platform_events;
create policy "platform_events_admin" on public.platform_events
  for select using (user_id = auth.uid());

drop policy if exists "platform_events_insert" on public.platform_events;
create policy "platform_events_insert" on public.platform_events
  for insert with check (user_id = auth.uid());

create index if not exists idx_platform_events_user on public.platform_events(user_id);
create index if not exists idx_platform_events_org  on public.platform_events(organization_id);
create index if not exists idx_platform_events_type on public.platform_events(event_type);
create index if not exists idx_platform_events_time on public.platform_events(created_at desc);

-- 4. Tutorial progress tracking
create table if not exists public.tutorial_progress (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  tutorial_id text        not null,
  completed   boolean     not null default false,
  watched_at  timestamptz,
  unique(user_id, tutorial_id)
);

alter table public.tutorial_progress enable row level security;

drop policy if exists "tutorial_progress_owner" on public.tutorial_progress;
create policy "tutorial_progress_owner" on public.tutorial_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
