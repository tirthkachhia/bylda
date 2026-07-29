-- Phase 5 — reliability & security hardening (minimal, additive):
--   1. RLS on the 8 previously unprotected tables
--   2. Stripe webhook idempotency ledger
--   3. Atomic quota consumption (kills the read-then-increment race)

-- ── 1. RLS ────────────────────────────────────────────────────────────
-- All service-role writes bypass RLS, so enabling it only closes the
-- anon/authenticated direct-query hole — no edge function changes needed.

-- user_id-owned tables: owner can read/insert/update their own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'credit_ledger',
    'operator_memory',
    'tool_outputs',
    'support_tickets',
    'user_ai_config',
    'automation_drafts',
    'client_kpi_metrics'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format(
      'create policy "%s_select_own" on public.%I for select using (user_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert with check (user_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format(
      'create policy "%s_update_own" on public.%I for update using (user_id = auth.uid())',
      t, t
    );
  end loop;
end;
$$;

-- n8n_error_log is system-level: admins read, only service role writes.
alter table public.n8n_error_log enable row level security;
drop policy if exists "n8n_error_log_select_admin" on public.n8n_error_log;
create policy "n8n_error_log_select_admin"
  on public.n8n_error_log for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::public.app_role));

-- ── 2. Stripe webhook idempotency ─────────────────────────────────────
-- payments-webhook records every event id it processes; a redelivered
-- event becomes a no-op instead of re-mutating subscription state.
create table if not exists public.stripe_webhook_events (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null unique,
  event_type  text not null,
  status      text not null default 'processed'
              check (status in ('processed', 'skipped', 'failed')),
  detail      text,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
drop policy if exists "stripe_webhook_events_select_admin" on public.stripe_webhook_events;
create policy "stripe_webhook_events_select_admin"
  on public.stripe_webhook_events for select
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::public.app_role));

-- ── 3. Atomic quota consumption ───────────────────────────────────────
-- Replaces the read-then-increment pattern in edge functions. One statement,
-- row-locked: concurrent runs can never both pass a nearly-exhausted limit.
-- Returns true when the run is allowed (and counted), false when over limit.
create or replace function public.consume_quota(
  p_organization_id uuid,
  p_tool_key        text,
  p_monthly_limit   integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'YYYY-MM');
  v_total  integer;
begin
  -- No limit on this plan → always allowed, still count usage.
  if p_monthly_limit is null then
    insert into public.usage_tracking (organization_id, period, tool_key, count)
    values (p_organization_id, v_period, p_tool_key, 1)
    on conflict (organization_id, period, tool_key)
    do update set count = usage_tracking.count + 1, updated_at = now();
    return true;
  end if;

  -- Serialize concurrent checks for this org+period (works even when no
  -- usage rows exist yet, unlike row locks).
  perform pg_advisory_xact_lock(hashtext(p_organization_id::text || v_period));

  select coalesce(sum(count), 0) into v_total
    from public.usage_tracking
   where organization_id = p_organization_id
     and period = v_period;

  if v_total >= p_monthly_limit then
    return false;
  end if;

  insert into public.usage_tracking (organization_id, period, tool_key, count)
  values (p_organization_id, v_period, p_tool_key, 1)
  on conflict (organization_id, period, tool_key)
  do update set count = usage_tracking.count + 1, updated_at = now();
  return true;
end;
$$;

-- Refund half of the pair: a failed run gives the credit back.
create or replace function public.refund_quota(
  p_organization_id uuid,
  p_tool_key        text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usage_tracking
     set count = greatest(count - 1, 0), updated_at = now()
   where organization_id = p_organization_id
     and period = to_char(now(), 'YYYY-MM')
     and tool_key = p_tool_key;
$$;

-- consume_quota's upsert requires this uniqueness; add it if the squash
-- migration didn't already.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usage_tracking_org_period_tool_key'
  ) then
    alter table public.usage_tracking
      add constraint usage_tracking_org_period_tool_key
      unique (organization_id, period, tool_key);
  end if;
exception when others then
  raise notice 'usage_tracking uniqueness: %', sqlerrm;
end;
$$;
