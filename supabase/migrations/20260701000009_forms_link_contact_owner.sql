-- Fix: contacts.user_id is NOT NULL and contacts RLS is user-scoped
-- (user_id = auth.uid()). System-created contacts must therefore be owned by a
-- real user — the org owner — so the insert succeeds and the owner can see the
-- contact. Redefines form_submissions_link_contact (Connection 6) accordingly.

create or replace function public.form_submissions_link_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text; _name text; _phone text; _form_name text; _cid uuid; _owner uuid; k text; v text;
begin
  if new.contact_id is not null then
    return new;
  end if;

  for k, v in select key, value from jsonb_each_text(new.data) loop
    if _email is null and v ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      _email := lower(v);
    elsif _phone is null and k ilike '%phone%' then
      _phone := v;
    elsif _name is null and k ilike '%name%' then
      _name := v;
    end if;
  end loop;

  if _email is null then
    return new;
  end if;

  -- Resolve the org owner (contacts are user-owned; system contacts belong to owner).
  select coalesce(o.owner_id, o.created_by) into _owner
  from public.organizations o where o.id = new.organization_id;
  if _owner is null then
    select user_id into _owner from public.organization_members
    where organization_id = new.organization_id order by created_at limit 1;
  end if;
  if _owner is null then
    return new;
  end if;

  -- Find an existing contact owned by that user, else create one.
  select id into _cid
  from public.contacts
  where org_id = new.organization_id and email = _email and user_id = _owner
  limit 1;

  if _cid is null then
    select name into _form_name from public.forms where id = new.form_id;
    insert into public.contacts (org_id, user_id, email, first_name, last_name, phone, source, tags)
    values (
      new.organization_id, _owner, _email,
      nullif(split_part(coalesce(_name, ''), ' ', 1), ''),
      nullif(trim(substr(coalesce(_name, ''), position(' ' in coalesce(_name, '')) + 1)), ''),
      _phone, 'form',
      case when _form_name is not null then array[_form_name] else '{}'::text[] end
    )
    returning id into _cid;
  end if;

  new.contact_id := _cid;
  return new;
exception
  when others then
    return new;
end;
$$;

revoke execute on function public.form_submissions_link_contact() from anon, authenticated, public;
