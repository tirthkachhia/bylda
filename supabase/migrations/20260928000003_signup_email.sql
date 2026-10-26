create table public.signup_email_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 marketing boolean not null default false,
 consent_at timestamptz,
 unsubscribe_token uuid not null default gen_random_uuid() unique
);
create table public.signup_email_queue (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('welcome','update')),
 subject text not null check(length(subject) between 1 and 200),
 body text not null check(length(body) between 1 and 20000),
 status text not null default 'queued' check(status in ('queued','sending','accepted','failed','skipped')),
 created_at timestamptz not null default now(),
 attempted_at timestamptz,
 provider_id text,
 error text
);
create unique index signup_welcome_once on public.signup_email_queue(user_id) where kind='welcome';
alter table public.signup_email_preferences enable row level security;
alter table public.signup_email_queue enable row level security;
revoke all on public.signup_email_preferences, public.signup_email_queue from anon, authenticated;
grant select(user_id,marketing,consent_at) on public.signup_email_preferences to authenticated;
grant select on public.signup_email_queue to authenticated;
create policy preferences_read on public.signup_email_preferences for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy email_admin_read on public.signup_email_queue for select to authenticated using(public.is_admin());

create function public.set_signup_email_preference(enabled boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 insert into signup_email_preferences(user_id,marketing,consent_at) values(auth.uid(),enabled,case when enabled then now() end)
 on conflict(user_id) do update set marketing=excluded.marketing,consent_at=excluded.consent_at;
end; $$;
revoke all on function public.set_signup_email_preference(boolean) from public,anon;
grant execute on function public.set_signup_email_preference(boolean) to authenticated;

create function public.enqueue_signup_welcome() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.email_confirmed_at is not null and (tg_op='INSERT' or old.email_confirmed_at is null) then
  insert into signup_email_preferences(user_id,marketing,consent_at)
  values(new.id,coalesce(new.raw_user_meta_data->>'email_updates','false')='true',
    case when new.raw_user_meta_data->>'email_updates'='true' then now() end)
  on conflict do nothing;
  insert into signup_email_queue(user_id,kind,subject,body)
  values(new.id,'welcome','Welcome to Bylda',E'Your Bylda account is ready.\n\nConnect your CRM or upload a call recording to turn conversations into evidence-backed insights and coaching.\n\nOpen your workspace: https://app.usebylda.com/app\n\nYou are receiving this account email because you signed up for Bylda.')
  on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.enqueue_signup_welcome() from public,anon,authenticated;
create trigger bylda_signup_welcome after insert or update of email_confirmed_at on auth.users for each row execute function public.enqueue_signup_welcome();

-- Existing users are NOT enrolled or sent retroactive welcome emails.
insert into signup_email_preferences(user_id) select id from auth.users on conflict do nothing;

create function public.queue_signup_update(email_subject text,email_body text) returns integer language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if length(trim(email_subject)) not between 1 and 200 or length(trim(email_body)) not between 1 and 20000 then raise exception 'Invalid email'; end if;
 insert into signup_email_queue(user_id,kind,subject,body)
 select p.user_id,'update',trim(email_subject),trim(email_body) from signup_email_preferences p
 join auth.users u on u.id=p.user_id where p.marketing and u.email_confirmed_at is not null and u.email is not null;
 get diagnostics total=row_count;
 return total;
end; $$;
revoke all on function public.queue_signup_update(text,text) from public,anon;
grant execute on function public.queue_signup_update(text,text) to authenticated;

create function public.claim_signup_emails() returns setof public.signup_email_queue language sql security definer set search_path=public as $$
 update signup_email_queue set status='sending',attempted_at=now()
 where id in(select id from signup_email_queue where status='queued' order by created_at for update skip locked limit 10) returning *;
$$;
revoke all on function public.claim_signup_emails() from public,anon,authenticated;
grant execute on function public.claim_signup_emails() to service_role;
