-- ─────────────────────────────────────────────────────────────────────────────
-- Automation activation + autonomous event triggering
--
-- Turns a published template into a LIVE automation for an org, and fires it
-- automatically when a matching event happens — using the repo's safe pattern:
-- DB triggers do transactional work only (enqueue an event row, never any HTTP,
-- always exception-guarded so they can't break the parent write), and a pg_cron
-- job drains the queue by calling the automation-dispatch edge function.
-- Everything no-ops cleanly when pg_cron/pg_net aren't installed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── active_automations: a template switched "on" for an org ───────────────────
create table if not exists public.active_automations (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references public.organizations(id) on delete cascade,
  template_id      uuid        not null references public.automation_templates(id) on delete cascade,
  created_by       uuid        references auth.users(id) on delete set null,
  -- The entry trigger block type, e.g. 'trigger_new_lead' / 'trigger_tag_added'.
  trigger_type     text        not null,
  is_active        boolean     not null default true,
  run_count        integer     not null default 0,
  last_fired_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, template_id)
);

alter table public.active_automations enable row level security;

create index if not exists idx_active_automations_org on public.active_automations(organization_id);
create index if not exists idx_active_automations_trigger
  on public.active_automations(organization_id, trigger_type) where is_active;

drop policy if exists "active_automations_org_member" on public.active_automations;
create policy "active_automations_org_member" on public.active_automations
  for all to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists trg_active_automations_updated on public.active_automations;
create trigger trg_active_automations_updated
  before update on public.active_automations
  for each row execute function public.set_updated_at();

-- ── automation_events: transactional event queue ─────────────────────────────
create table if not exists public.automation_events (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references public.organizations(id) on delete cascade,
  -- Normalized event name: 'contact.created' | 'tag.added' | 'payment.received'.
  event_type       text        not null,
  contact_id       uuid,
  payload          jsonb       not null default '{}',
  status           text        not null default 'pending'
                     check (status in ('pending', 'processing', 'done', 'error')),
  attempts         integer     not null default 0,
  error            text,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);

alter table public.automation_events enable row level security;

create index if not exists idx_automation_events_pending
  on public.automation_events(created_at) where status = 'pending';
create index if not exists idx_automation_events_org on public.automation_events(organization_id);

-- Org members can read their events (history); writes happen via SECURITY DEFINER
-- triggers / service role only.
drop policy if exists "automation_events_org_read" on public.automation_events;
create policy "automation_events_org_read" on public.automation_events
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

-- ── which block triggers each event can fire ──────────────────────────────────
create or replace function public.automation_triggers_for_event(_event text)
returns text[]
language sql immutable
as $$
  select case _event
    when 'contact.created'  then array['trigger_new_lead', 'trigger_contact_created']
    when 'tag.added'        then array['trigger_tag_added']
    when 'payment.received' then array['trigger_payment']
    else array[]::text[]
  end;
$$;

-- ── enqueue helper (only enqueues when a matching live automation exists) ─────
create or replace function public.enqueue_automation_event(
  _org uuid, _event text, _contact uuid, _payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _org is null then
    return;
  end if;
  -- Cheap gate: skip entirely unless this org has a live automation for the event.
  if not exists (
    select 1 from public.active_automations
    where organization_id = _org
      and is_active
      and trigger_type = any (public.automation_triggers_for_event(_event))
  ) then
    return;
  end if;

  insert into public.automation_events (organization_id, event_type, contact_id, payload)
  values (_org, _event, _contact, coalesce(_payload, '{}'::jsonb));
exception
  when others then
    -- Never let event capture break the parent write.
    return;
end;
$$;

-- ── contacts trigger: new contact + new tag → events ─────────────────────────
create or replace function public.contacts_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_tags text[];
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_automation_event(
      new.org_id, 'contact.created', new.id,
      jsonb_build_object('email', new.email, 'source', new.source)
    );
  elsif tg_op = 'UPDATE' then
    -- tags added since the previous version
    _new_tags := array(
      select unnest(coalesce(new.tags, '{}'))
      except
      select unnest(coalesce(old.tags, '{}'))
    );
    if array_length(_new_tags, 1) is not null then
      perform public.enqueue_automation_event(
        new.org_id, 'tag.added', new.id,
        jsonb_build_object('tags', to_jsonb(_new_tags))
      );
    end if;
  end if;
  return null; -- AFTER trigger
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_contacts_automation_insert on public.contacts;
create trigger trg_contacts_automation_insert
  after insert on public.contacts
  for each row execute function public.contacts_emit_automation_events();

drop trigger if exists trg_contacts_automation_update on public.contacts;
create trigger trg_contacts_automation_update
  after update of tags on public.contacts
  for each row execute function public.contacts_emit_automation_events();

-- ── bump_active_automation: counter the dispatcher bumps after each fire ──────
create or replace function public.bump_active_automation(_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.active_automations
  set run_count = run_count + 1, last_fired_at = now()
  where id = _id;
$$;

revoke execute on function public.bump_active_automation(uuid) from public;
revoke execute on function public.bump_active_automation(uuid) from anon;
revoke execute on function public.bump_active_automation(uuid) from authenticated;
grant execute on function public.bump_active_automation(uuid) to service_role;

-- ── pg_cron drain (no-op without pg_cron) ────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('automation-dispatch-1min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-dispatch-1min');

    PERFORM cron.schedule(
      'automation-dispatch-1min',
      '* * * * *',
      $job$
        SELECT net.http_post(
          url     := current_setting('app.settings.supabase_url') || '/functions/v1/automation-dispatch',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body    := '{}'::jsonb
        ) AS request_id;
      $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — enable it to auto-fire automations (automation-dispatch-1min).';
  END IF;
END;
$$;
