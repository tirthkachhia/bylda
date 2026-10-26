-- Jev (TypeSafe) scoring output, written by the bylda-coaching-transcriber worker
-- with the service role. Members read; nothing writes through RLS.
--   call_exchange_scores   one row per exchange: temperature, rep move, playbook step, risk
--   call_score_summaries   one row per call: peak/final/drop, coverage, coaching value, quality
--   call_learning_moments  ranked exchanges worth coaching on, with the words, for weekly reports

create table if not exists public.call_exchange_scores (
  id                        uuid primary key default gen_random_uuid(),
  call_id                   uuid not null references public.calls(id) on delete cascade,
  organization_id           uuid not null references public.organizations(id) on delete cascade,
  exchange_index            integer not null,
  start_s                   numeric,
  end_s                     numeric,
  temperature_score         numeric(5,3) not null,
  temperature_confidence    numeric(4,3) not null,
  temperature_probabilities jsonb not null default '{}'::jsonb,
  delta                     numeric(5,3),
  rep_move_score            numeric(5,3),
  rep_move_confidence       numeric(4,3),
  playbook_step             text,
  playbook_step_confidence  numeric(4,3),
  risk_probability          numeric(4,3),
  truncated                 boolean not null default false,
  scoring_version           integer not null default 1,
  model                     text,
  input_tokens              integer,
  created_at                timestamptz not null default now(),
  unique (call_id, exchange_index)
);

create table if not exists public.call_score_summaries (
  call_id                    uuid primary key references public.calls(id) on delete cascade,
  organization_id            uuid not null references public.organizations(id) on delete cascade,
  rep_id                     uuid references public.reps(id) on delete set null,
  exchange_count             integer not null default 0,
  duration_seconds           integer,
  peak_temperature           numeric(5,3) not null default 0,
  final_temperature          numeric(5,3) not null default 0,
  biggest_drop               numeric(5,3) not null default 0,
  biggest_drop_exchange_index integer,
  mean_confidence            numeric(4,3) not null default 0,
  rep_move_average           numeric(5,3),
  playbook_coverage          numeric(4,3),
  risk_count                 integer not null default 0,
  coaching_value_label       text not null default 'low',
  coaching_value_score       integer not null default 0,
  quality_score              integer not null default 0,
  features                   jsonb not null default '{}'::jsonb,
  playbook_id                uuid references public.coaching_playbooks(id) on delete set null,
  playbook_version_id        uuid references public.coaching_playbook_versions(id) on delete set null,
  scoring_version            integer not null default 1,
  model                      text,
  total_input_tokens         integer,
  cost_usd                   numeric(10,6),
  computed_at                timestamptz not null default now(),
  constraint call_score_summaries_label_check
    check (coaching_value_label in ('low', 'medium', 'high'))
);

create table if not exists public.call_learning_moments (
  id               uuid primary key default gen_random_uuid(),
  call_id          uuid not null references public.calls(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  rep_id           uuid references public.reps(id) on delete set null,
  exchange_index   integer not null,
  type             text not null,
  score            numeric(6,3) not null,
  delta            numeric(5,3),
  confidence       numeric(4,3),
  risk_probability numeric(4,3),
  rep_move         numeric(5,3),
  low_confidence   boolean not null default false,
  rep_text         text,
  customer_text    text,
  created_at       timestamptz not null default now(),
  constraint call_learning_moments_type_check
    check (type in ('temperature_drop', 'risk_flag', 'weak_move'))
);

alter table public.call_exchange_scores enable row level security;
alter table public.call_score_summaries enable row level security;
alter table public.call_learning_moments enable row level security;

drop policy if exists "call_exchange_scores_org_read" on public.call_exchange_scores;
create policy "call_exchange_scores_org_read" on public.call_exchange_scores
  for select to authenticated using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "call_score_summaries_org_read" on public.call_score_summaries;
create policy "call_score_summaries_org_read" on public.call_score_summaries
  for select to authenticated using (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "call_learning_moments_org_read" on public.call_learning_moments;
create policy "call_learning_moments_org_read" on public.call_learning_moments
  for select to authenticated using (public.is_org_member(organization_id, auth.uid()));

create index if not exists idx_call_exchange_scores_call
  on public.call_exchange_scores (call_id, exchange_index);
create index if not exists idx_call_score_summaries_org_rep
  on public.call_score_summaries (organization_id, rep_id, computed_at desc);
create index if not exists idx_call_learning_moments_org_rep
  on public.call_learning_moments (organization_id, rep_id, created_at desc);
create index if not exists idx_call_learning_moments_call
  on public.call_learning_moments (call_id, score desc);

grant select on public.call_exchange_scores to authenticated;
grant select on public.call_score_summaries to authenticated;
grant select on public.call_learning_moments to authenticated;
