-- Track auto-graduation: create → operate on first won deal.
--
-- The server-side half of track auto-detection. The client resolves the
-- starting track from onboarding signals (resolveMode() in
-- src/constants/onboarding-questions.ts); this trigger upgrades a workspace
-- that started on the CREATE track the moment its first deal is won — because
-- a business closing deals is, by definition, operating.
--
-- Additive alongside the existing Won-stage triggers on public.leads
-- (trg_leads_notify, trg_leads_automation_stage). Postgres fires every matching
-- trigger on the same event, so this runs in addition to — never instead of —
-- those. SECURITY DEFINER; RPC EXECUTE revoked (trigger-only). Idempotent: it
-- no-ops once the workspace is already 'operate', so later Won deals don't
-- re-notify.

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
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_leads_track_graduation on public.leads;
create trigger trg_leads_track_graduation
  after update of stage on public.leads
  for each row execute function public.evaluate_track_graduation();

revoke execute on function public.evaluate_track_graduation() from anon, authenticated, public;
