-- contact.created producer: emit a nova_events row whenever a contact is created.
--
-- Contacts are inserted from several places — the People page "Add contact"
-- button and its CSV bulk import (client-side, direct table inserts), and the
-- Nova AI create_contact action (executeCreateContact in the nova-action /
-- nova-chat edge functions). The client paths cannot write nova_events
-- themselves: nova_events carries an insert policy of `with check (false)`, so
-- only the service-role (RLS-bypassing) edge functions could, and the manual
-- button never touches an edge function. A single AFTER INSERT trigger on
-- contacts covers every path uniformly and is impossible to bypass.
--
-- This makes the trigger the one canonical producer, so the best-effort
-- nova_events inserts previously added to crm-action and to
-- _shared/novaActions.ts::executeCreateContact are removed in the same change
-- to avoid double-emitting.
--
-- Mirrors evaluate_track_graduation()'s discipline: SECURITY DEFINER + owned by
-- the table owner so it bypasses the nova_events_no_client_insert RLS the same
-- way service-role writes do (no client can forge the event), and the ledger
-- insert is isolated in its own nested exception block so a failure there can
-- never roll back the contact insert that triggered it.

create or replace function public.emit_contact_created_nova_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- contacts.org_id is nullable, but nova_events.organization_id is NOT NULL:
  -- skip org-less contacts rather than fail the insert.
  if new.org_id is null then
    return null;
  end if;

  -- Best-effort ledger row. source column mirrors crm-action ('crm'); the
  -- payload carries the contact's own source (defaulting to 'nova' when unset),
  -- matching the shape the earlier edge-function producers wrote.
  begin
    insert into public.nova_events (organization_id, source, event_type, subject_type, subject_id, payload)
    values (new.org_id, 'crm', 'contact.created', 'contact', new.id,
      jsonb_build_object('source', coalesce(new.source, 'nova')));
  exception
    when others then null;
  end;

  return null;
end;
$$;

drop trigger if exists trg_contacts_nova_event on public.contacts;
create trigger trg_contacts_nova_event
  after insert on public.contacts
  for each row execute function public.emit_contact_created_nova_event();

revoke execute on function public.emit_contact_created_nova_event() from anon, authenticated, public;
