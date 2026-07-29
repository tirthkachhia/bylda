-- Rebrand: rename the Nova-era event/action tables to their Bylda names.
--
-- The product rebranded Nova → Bylda. Application code (src, workers, edge
-- functions, generated types) now reads/writes bylda_actions / bylda_events /
-- bylda_conversations. This migration renames the physical tables to match and
-- recreates the two SECURITY DEFINER trigger functions that insert into the
-- events ledger by name — a plain ALTER TABLE ... RENAME moves indexes,
-- constraints, RLS policies, foreign keys and dependent views automatically,
-- but PL/pgSQL bodies resolve table names at run time, so those two functions
-- must be re-pointed explicitly or they would fail after the rename.
--
-- Additive and convergent: on a fresh database the historical migrations create
-- the nova_* tables and this renames them to bylda_*; on production this renames
-- the already-applied nova_* tables. Both end in the same bylda_* schema. The
-- IF EXISTS guards make the renames safe to re-run.

-- ── 1. Rename the tables ─────────────────────────────────────────────────────
alter table if exists public.nova_actions       rename to bylda_actions;
alter table if exists public.nova_events         rename to bylda_events;
alter table if exists public.nova_conversations  rename to bylda_conversations;

-- ── 2. Re-point the graduation ledger trigger to bylda_events ────────────────
--     Same body as evaluate_track_graduation(); only the ledger table name and
--     the user-facing notification copy change (Nova → Bylda).
create or replace function public.evaluate_track_graduation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _workspace_id   uuid;
  _workspace_mode text;
  _owner_id       uuid;
begin
  if tg_op = 'UPDATE' and new.stage = 'Won' and old.stage is distinct from new.stage then
    select id, mode into _workspace_id, _workspace_mode
    from public.workspaces
    where organization_id = new.organization_id
    limit 1;

    if _workspace_id is null or _workspace_mode = 'operate' then
      return null;
    end if;

    update public.workspaces set mode = 'operate' where id = _workspace_id;

    update public.business_context
      set identity = identity || jsonb_build_object('mode', 'operate'),
          stage    = stage    || jsonb_build_object('graduated_at', now())
    where organization_id = new.organization_id;

    perform public.notify_org_members(new.organization_id, 'track_graduated',
      'Bylda noticed your first deal closed — unlocking Operator tools for your business.');

    select owner_id into _owner_id
    from public.organizations
    where id = new.organization_id;

    if _owner_id is not null then
      insert into public.activation_events (user_id, workspace_id, event_name, properties)
      values (_owner_id, _workspace_id, 'track_graduated',
        jsonb_build_object('trigger', 'lead_won', 'lead_id', new.id,
                            'organization_id', new.organization_id));
    end if;

    -- Bylda event ledger row (renamed from nova_events). Best-effort + isolated.
    begin
      insert into public.bylda_events (organization_id, source, event_type, subject_type, subject_id, payload)
      values (new.organization_id, 'track', 'track.graduated', 'workspace', _workspace_id,
        jsonb_build_object('trigger', 'lead_won', 'lead_id', new.id));
    exception
      when others then null;
    end;
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

-- ── 3. Rename the contact.created producer function + trigger to Bylda ───────
create or replace function public.emit_contact_created_bylda_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    return null;
  end if;

  begin
    insert into public.bylda_events (organization_id, source, event_type, subject_type, subject_id, payload)
    values (new.org_id, 'crm', 'contact.created', 'contact', new.id,
      jsonb_build_object('source', coalesce(new.source, 'bylda')));
  exception
    when others then null;
  end;

  return null;
end;
$$;

-- Swap the trigger over to the renamed function, then drop the old one.
drop trigger if exists trg_contacts_nova_event on public.contacts;
drop trigger if exists trg_contacts_bylda_event on public.contacts;
create trigger trg_contacts_bylda_event
  after insert on public.contacts
  for each row execute function public.emit_contact_created_bylda_event();

drop function if exists public.emit_contact_created_nova_event();

revoke execute on function public.emit_contact_created_bylda_event() from anon, authenticated, public;
revoke execute on function public.evaluate_track_graduation() from anon, authenticated, public;
