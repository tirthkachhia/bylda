-- Organization-specific CRM intelligence generated from the short setup interview.
-- The generated profile is consumed by analyze-call, so questionnaire answers
-- change extraction and write-back behavior instead of remaining onboarding copy.
create table if not exists public.crm_intelligence_profiles (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null unique references public.organizations(id) on delete cascade,
  created_by                uuid references auth.users(id) on delete set null,
  status                    text not null default 'active',
  questionnaire_answers     jsonb not null default '{}'::jsonb,
  generated_profile         jsonb not null default '{}'::jsonb,
  base_sales_profile        text not null default 'generic',
  auto_write_min_confidence numeric(4,3) not null default 0.820,
  version                   integer not null default 1,
  generated_at              timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint crm_intelligence_profiles_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint crm_intelligence_profiles_confidence_check
    check (auto_write_min_confidence between 0.5 and 1.0)
);

alter table public.crm_intelligence_profiles enable row level security;

drop policy if exists "crm_intelligence_profiles_org_read" on public.crm_intelligence_profiles;
create policy "crm_intelligence_profiles_org_read"
  on public.crm_intelligence_profiles for select to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = crm_intelligence_profiles.organization_id
        and member.user_id = auth.uid()
    )
  );

drop policy if exists "crm_intelligence_profiles_org_insert" on public.crm_intelligence_profiles;
create policy "crm_intelligence_profiles_org_insert"
  on public.crm_intelligence_profiles for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.organization_members member
      where member.organization_id = crm_intelligence_profiles.organization_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
  );

drop policy if exists "crm_intelligence_profiles_org_update" on public.crm_intelligence_profiles;
create policy "crm_intelligence_profiles_org_update"
  on public.crm_intelligence_profiles for update to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = crm_intelligence_profiles.organization_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = crm_intelligence_profiles.organization_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
  );

drop trigger if exists trg_crm_intelligence_profiles_updated
  on public.crm_intelligence_profiles;
create trigger trg_crm_intelligence_profiles_updated
  before update on public.crm_intelligence_profiles
  for each row execute function public.set_updated_at();

create index if not exists idx_crm_intelligence_profiles_active
  on public.crm_intelligence_profiles (organization_id, status)
  where status = 'active';

grant select, insert, update on public.crm_intelligence_profiles to authenticated;
