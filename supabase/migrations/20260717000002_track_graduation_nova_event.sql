-- Close the track.graduated event chain: emit a nova_events row on graduation.
--
-- evaluate_track_graduation() already flips the workspace to 'operate', patches
-- business_context, notifies the org, and logs an activation_event — but it never
-- wrote the nova_events ledger row that use-business-graph's recommendation engine
-- reads (signals.recentlyGraduated → the "explore-operator-tools" recommendation).
-- The reader was built ahead of this producer; this migration adds the producer so
-- a real first-won-deal actually surfaces the recommendation.
--
-- Mirrors the best-effort nova_events dual-write in the advance-mission edge
-- function (step.completed / mission.completed): additive, and isolated in its own
-- nested exception block so a ledger-insert failure can never undo the graduation
-- writes that precede it. The trigger is SECURITY DEFINER and owned by the table
-- owner, so it bypasses the nova_events_no_client_insert (with check (false)) RLS
-- the same way service-role writes do — no client can forge this event.
--
-- Idempotent by construction: the enclosing function already no-ops once the
-- workspace is 'operate', so this row is written exactly once, on the first Won deal.

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
    -- The org has exactly one workspace (workspaces.organization_id is unique).
    select id, mode into _workspace_id, _workspace_mode
    from public.workspaces
    where organization_id = new.organization_id
    limit 1;

    -- No workspace yet, or already graduated: no-op. Guarding on 'operate'
    -- keeps every Won deal after the first from re-firing the notification.
    if _workspace_id is null or _workspace_mode = 'operate' then
      return null;
    end if;

    -- a. Flip the track.
    update public.workspaces set mode = 'operate' where id = _workspace_id;

    -- b. Reflect the graduation in the Business Context Graph every AI call reads.
    update public.business_context
      set identity = identity || jsonb_build_object('mode', 'operate'),
          stage    = stage    || jsonb_build_object('graduated_at', now())
    where organization_id = new.organization_id;

    -- c. Tell the org.
    perform public.notify_org_members(new.organization_id, 'track_graduated',
      'Nova noticed your first deal closed — unlocking Operator tools for your business.');

    -- d. Activation event. leads carries no reliable user_id, so source it from
    --    organizations.owner_id (the workspace/org owner).
    select owner_id into _owner_id
    from public.organizations
    where id = new.organization_id;

    if _owner_id is not null then
      insert into public.activation_events (user_id, workspace_id, event_name, properties)
      values (_owner_id, _workspace_id, 'track_graduated',
        jsonb_build_object('trigger', 'lead_won', 'lead_id', new.id,
                            'organization_id', new.organization_id));
    end if;

    -- e. Nova event ledger row — the signal use-business-graph reads for the
    --    "explore-operator-tools" recommendation. Best-effort and isolated: a
    --    failure here must never roll back the graduation writes above.
    begin
      insert into public.nova_events (organization_id, source, event_type, subject_type, subject_id, payload)
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

-- Trigger definition is unchanged; re-created here for self-containment/idempotency.
drop trigger if exists trg_leads_track_graduation on public.leads;
create trigger trg_leads_track_graduation
  after update of stage on public.leads
  for each row execute function public.evaluate_track_graduation();

revoke execute on function public.evaluate_track_graduation() from anon, authenticated, public;
