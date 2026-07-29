-- In-app notifications for key CRM events. Fans a per-org event out to a
-- notification row per org member (notifications is user-scoped). SECURITY
-- DEFINER; RPC EXECUTE revoked (trigger-only). Idempotent.

create or replace function public.notify_org_members(_org uuid, _type text, _message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, message, read)
  select om.user_id, _type, _message, false
  from public.organization_members om
  where om.organization_id = _org;
exception
  when others then
    return;
end;
$$;
revoke execute on function public.notify_org_members(uuid, text, text) from anon, authenticated, public;

-- leads: new lead + deal won
create or replace function public.leads_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_org_members(new.organization_id, 'new_lead',
      'New lead: ' || coalesce(new.name, 'Unnamed'));
  elsif tg_op = 'UPDATE' and new.stage = 'Won' and old.stage is distinct from new.stage then
    perform public.notify_org_members(new.organization_id, 'deal_won',
      'Deal won: ' || coalesce(new.name, 'Unnamed'));
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;
drop trigger if exists trg_leads_notify on public.leads;
create trigger trg_leads_notify
  after insert or update of stage on public.leads
  for each row execute function public.leads_notify();
revoke execute on function public.leads_notify() from anon, authenticated, public;

-- calendar_events: appointment booked
create or replace function public.calendar_events_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_org_members(new.organization_id, 'appointment_booked',
    'Appointment booked: ' || coalesce(new.title, 'Untitled'));
  return null;
exception
  when others then
    return null;
end;
$$;
drop trigger if exists trg_calendar_events_notify on public.calendar_events;
create trigger trg_calendar_events_notify
  after insert on public.calendar_events
  for each row execute function public.calendar_events_notify();
revoke execute on function public.calendar_events_notify() from anon, authenticated, public;

-- conversations: inbound message
create or replace function public.conversations_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'inbound' then
    perform public.notify_org_members(new.organization_id, 'message_received',
      'New ' || new.channel || ' message received');
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;
drop trigger if exists trg_conversations_notify on public.conversations;
create trigger trg_conversations_notify
  after insert on public.conversations
  for each row execute function public.conversations_notify();
revoke execute on function public.conversations_notify() from anon, authenticated, public;

-- Live bell: put notifications in the realtime publication.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END;
$$;
