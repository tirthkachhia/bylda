-- ── Phase 6: Customer Success ────────────────────────────────────────────────
-- Post-close lifecycle: customer_accounts (distinct from leads), success_plans,
-- and adoption_events (usage signals) that feed churn-risk scoring.
-- Additive and idempotent.

-- ── customer_accounts ────────────────────────────────────────────────────────
create table if not exists public.customer_accounts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,   -- won deal it came from
  name            text not null,
  owner_id        uuid references auth.users(id) on delete set null,     -- CSM
  stage           text not null default 'onboarding'
                    check (stage in ('onboarding', 'active', 'at_risk', 'churned')),
  health_score    smallint not null default 70 check (health_score between 0 and 100),
  mrr             numeric not null default 0,
  renewal_date    date,
  started_at      date,
  churned_at      date,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.customer_accounts enable row level security;
create index if not exists idx_customer_accounts_org     on public.customer_accounts(organization_id, stage);
create index if not exists idx_customer_accounts_company on public.customer_accounts(company_id);
create index if not exists idx_customer_accounts_renewal on public.customer_accounts(renewal_date);

drop policy if exists "customer_accounts_org_member" on public.customer_accounts;
create policy "customer_accounts_org_member" on public.customer_accounts
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_customer_accounts_updated on public.customer_accounts;
create trigger trg_customer_accounts_updated
  before update on public.customer_accounts
  for each row execute function public.set_updated_at();

-- ── success_plans ────────────────────────────────────────────────────────────
create table if not exists public.success_plans (
  id                  uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references public.customer_accounts(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  title               text not null,
  objectives          jsonb not null default '[]',  -- [{ label, done, due }]
  status              text not null default 'active' check (status in ('active', 'achieved', 'off_track', 'archived')),
  target_date         date,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.success_plans enable row level security;
create index if not exists idx_success_plans_account on public.success_plans(customer_account_id);

drop policy if exists "success_plans_org_member" on public.success_plans;
create policy "success_plans_org_member" on public.success_plans
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_success_plans_updated on public.success_plans;
create trigger trg_success_plans_updated
  before update on public.success_plans
  for each row execute function public.set_updated_at();

-- ── adoption_events (product usage signals) ──────────────────────────────────
create table if not exists public.adoption_events (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  customer_account_id uuid references public.customer_accounts(id) on delete cascade,
  contact_id          uuid references public.contacts(id) on delete set null,
  event_type          text not null,   -- login | feature_use | milestone | support_ticket | nps ...
  weight              numeric not null default 1,
  occurred_at         timestamptz not null default now(),
  metadata            jsonb not null default '{}'
);
alter table public.adoption_events enable row level security;
create index if not exists idx_adoption_events_account on public.adoption_events(customer_account_id, occurred_at desc);
create index if not exists idx_adoption_events_org     on public.adoption_events(organization_id, occurred_at desc);

drop policy if exists "adoption_events_org_member" on public.adoption_events;
create policy "adoption_events_org_member" on public.adoption_events
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
