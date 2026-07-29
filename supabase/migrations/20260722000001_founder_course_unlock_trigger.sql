-- Founder Course progression — DB-enforced module unlock.
--
-- When a course module (a missions row carrying generated_from_casefile_id)
-- transitions to 'completed', unlock the next locked course module in order and
-- point the workspace at it. advance-mission already marks the module completed
-- once its last step finishes; this trigger handles progression atomically so
-- no edge-function logic (or parallel tracker) is needed.

create or replace function public.unlock_next_course_module()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
begin
  -- Only course modules, and only on the real transition into 'completed'.
  if new.generated_from_casefile_id is null then
    return new;
  end if;
  if old.status = 'completed' then
    return new;
  end if;

  select id into v_next
  from public.missions
  where workspace_id = new.workspace_id
    and generated_from_casefile_id is not null
    and status = 'locked'
    and sort_order > new.sort_order
  order by sort_order asc
  limit 1;

  if v_next is not null then
    update public.missions set status = 'active' where id = v_next;
    update public.workspaces set current_mission_id = v_next where id = new.workspace_id;
  end if;

  return new;
end;
$$;

-- Fire only when status is set to 'completed' on a course module. The unlocked
-- module goes locked→active, whose status is not 'completed', so the WHEN clause
-- keeps the trigger from recursing.
drop trigger if exists trg_unlock_next_course_module on public.missions;
create trigger trg_unlock_next_course_module
  after update of status on public.missions
  for each row
  when (new.status = 'completed' and new.generated_from_casefile_id is not null)
  execute function public.unlock_next_course_module();
