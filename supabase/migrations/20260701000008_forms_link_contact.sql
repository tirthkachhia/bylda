-- Cross-system Connection 6: Forms → CRM. A form submission (including from the
-- public capture page, contact_id null) finds-or-creates a contact from its
-- data and links it, tagged with the form's name. Runs BEFORE INSERT so the
-- form.submitted automation event (AFTER trigger) carries the real contact_id.

create or replace function public.form_submissions_link_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
  _name  text;
  _phone text;
  _form_name text;
  _cid uuid;
  k text;
  v text;
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

  -- Need an email to dedupe/create a meaningful contact.
  if _email is null then
    return new;
  end if;

  select id into _cid
  from public.contacts
  where org_id = new.organization_id and email = _email
  limit 1;

  if _cid is null then
    select name into _form_name from public.forms where id = new.form_id;
    insert into public.contacts (org_id, email, first_name, last_name, phone, source, tags)
    values (
      new.organization_id,
      _email,
      nullif(split_part(coalesce(_name, ''), ' ', 1), ''),
      nullif(trim(substr(coalesce(_name, ''), position(' ' in coalesce(_name, '')) + 1)), ''),
      _phone,
      'form',
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

drop trigger if exists trg_form_submissions_link_contact on public.form_submissions;
create trigger trg_form_submissions_link_contact
  before insert on public.form_submissions
  for each row execute function public.form_submissions_link_contact();

revoke execute on function public.form_submissions_link_contact() from anon, authenticated, public;
