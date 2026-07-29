-- Counter triggers: keep denormalized counts accurate without client writes.
--
-- forms.submission_count is shown in the Forms UI and incremented from the
-- public capture page (anon), which can't update forms under RLS — so a
-- SECURITY DEFINER trigger maintains it. Additive + idempotent.

create or replace function public.bump_form_submission_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.forms
     set submission_count = coalesce(submission_count, 0) + 1
   where id = new.form_id;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_form_submission_count on public.form_submissions;
create trigger trg_form_submission_count
  after insert on public.form_submissions
  for each row execute function public.bump_form_submission_count();

-- tags.usage_count: bump when a contact gains a tag that matches a defined tag.
create or replace function public.bump_tag_usage_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _added text[];
begin
  if tg_op = 'INSERT' then
    _added := coalesce(new.tags, '{}');
  else
    _added := array(
      select unnest(coalesce(new.tags, '{}'))
      except
      select unnest(coalesce(old.tags, '{}'))
    );
  end if;
  if array_length(_added, 1) is not null then
    update public.tags
       set usage_count = coalesce(usage_count, 0) + 1
     where organization_id = new.org_id
       and name = any (_added);
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

drop trigger if exists trg_contacts_tag_usage_insert on public.contacts;
create trigger trg_contacts_tag_usage_insert
  after insert on public.contacts
  for each row execute function public.bump_tag_usage_counts();

drop trigger if exists trg_contacts_tag_usage_update on public.contacts;
create trigger trg_contacts_tag_usage_update
  after update of tags on public.contacts
  for each row execute function public.bump_tag_usage_counts();
