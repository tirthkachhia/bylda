-- ─────────────────────────────────────────────────────────────────────────────
-- Autonomous triggers for the visual workflow engine (automation_workflows).
--
-- The existing automation_events queue + automation-dispatch only knew about
-- contact.created / tag.added / payment.received and only fired template-based
-- active_automations. This migration:
--   1. maps dotted events → automation_workflows.trigger_type,
--   2. widens enqueue_automation_event's gate so events also enqueue when a live
--      automation_workflow matches (previously they were dropped),
--   3. emits the missing events from leads (stage change), form_submissions,
--      calendar_events (booked / cancelled / no_show), and inbound conversations.
-- Additive + idempotent. automation-dispatch then fans these out to workflow-engine.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Dotted event → automation_workflows.trigger_type
create or replace function public.automation_workflow_trigger_for_event(_event text)
returns text
language sql
immutable
set search_path = public
as $$
  select case _event
    when 'contact.created'       then 'contact_created'
    when 'tag.added'             then 'contact_tagged'
    when 'payment.received'      then 'payment_received'
    when 'lead.stage_changed'    then 'lead_stage_changed'
    when 'form.submitted'        then 'form_submitted'
    when 'appointment.booked'    then 'appointment_booked'
    when 'appointment.cancelled' then 'appointment_cancelled'
    when 'appointment.no_show'   then 'appointment_no_show'
    when 'message.received'      then 'message_received'
    else null
  end;
$$;

-- 2. Widen the enqueue gate: enqueue if a live template automation OR a live
--    visual workflow matches the event.
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
  if not exists (
        select 1 from public.active_automations
        where organization_id = _org
          and is_active
          and trigger_type = any (public.automation_triggers_for_event(_event))
      )
     and not exists (
        select 1 from public.automation_workflows
        where organization_id = _org
          and is_active
          and trigger_type = public.automation_workflow_trigger_for_event(_event)
      )
  then
    return;
  end if;

  insert into public.automation_events (organization_id, event_type, contact_id, payload)
  values (_org, _event, _contact, coalesce(_payload, '{}'::jsonb));
exception
  when others then
    return;
end;
$$;

-- 3a. leads: stage change → lead.stage_changed
create or replace function public.leads_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    perform public.enqueue_automation_event(
      new.organization_id, 'lead.stage_changed', new.contact_id,
      jsonb_build_object('from', old.stage::text, 'to', new.stage::text,
                         'stage', new.stage::text, 'lead_id', new.id)
    );
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_leads_automation_stage on public.leads;
create trigger trg_leads_automation_stage
  after update of stage on public.leads
  for each row execute function public.leads_emit_automation_events();

-- 3b. form_submissions: insert → form.submitted
create or replace function public.form_submissions_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_automation_event(
    new.organization_id, 'form.submitted', new.contact_id,
    jsonb_build_object('form_id', new.form_id)
  );
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_form_submissions_automation on public.form_submissions;
create trigger trg_form_submissions_automation
  after insert on public.form_submissions
  for each row execute function public.form_submissions_emit_automation_events();

-- 3c. calendar_events: booked / cancelled / no_show
create or replace function public.calendar_events_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_automation_event(
      new.organization_id, 'appointment.booked', new.contact_id,
      jsonb_build_object('event_id', new.id, 'start_time', new.start_time)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'cancelled' then
      perform public.enqueue_automation_event(
        new.organization_id, 'appointment.cancelled', new.contact_id,
        jsonb_build_object('event_id', new.id)
      );
    elsif new.status = 'no_show' then
      perform public.enqueue_automation_event(
        new.organization_id, 'appointment.no_show', new.contact_id,
        jsonb_build_object('event_id', new.id)
      );
    end if;
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_calendar_events_automation_insert on public.calendar_events;
create trigger trg_calendar_events_automation_insert
  after insert on public.calendar_events
  for each row execute function public.calendar_events_emit_automation_events();

drop trigger if exists trg_calendar_events_automation_update on public.calendar_events;
create trigger trg_calendar_events_automation_update
  after update of status on public.calendar_events
  for each row execute function public.calendar_events_emit_automation_events();

-- 3d. conversations: inbound message → message.received
create or replace function public.conversations_emit_automation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'inbound' then
    perform public.enqueue_automation_event(
      new.organization_id, 'message.received', new.contact_id,
      jsonb_build_object('conversation_id', new.id, 'channel', new.channel)
    );
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_conversations_automation on public.conversations;
create trigger trg_conversations_automation
  after insert on public.conversations
  for each row execute function public.conversations_emit_automation_events();
