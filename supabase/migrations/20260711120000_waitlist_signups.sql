-- ── Waitlist signups ──────────────────────────────────────────────────
-- Captures the 5-question waitlist form on nova-ops.space/waitlist.
-- The public site inserts anonymously (insert-only); platform admins
-- view and manage entries from /app/crm/waitlist. When a signup later
-- creates a platform account, an auth.users trigger flips their row to
-- 'joined' so they drop off the active waitlist automatically.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  segment text,
  bottleneck text,
  revenue text,
  ref text,
  page text,
  status text not null default 'waiting'
    check (status in ('waiting', 'invited', 'joined', 'removed')),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  constraint waitlist_email_format check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint waitlist_name_len check (char_length(name) between 1 and 120),
  constraint waitlist_field_len check (
    coalesce(char_length(email), 0) <= 254
    and coalesce(char_length(segment), 0) <= 200
    and coalesce(char_length(bottleneck), 0) <= 200
    and coalesce(char_length(revenue), 0) <= 200
    and coalesce(char_length(ref), 0) <= 200
    and coalesce(char_length(page), 0) <= 200
  )
);

-- One spot per email; duplicate submits surface as 409 to the form.
create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));
create index if not exists waitlist_signups_status_idx
  on public.waitlist_signups (status, created_at desc);

alter table public.waitlist_signups enable row level security;

-- Public form: insert only, always lands as an unclaimed 'waiting' row.
create policy "waitlist_public_insert" on public.waitlist_signups
  for insert to anon, authenticated
  with check (status = 'waiting' and user_id is null);

-- Platform admins: full visibility + management.
create policy "waitlist_admin_select" on public.waitlist_signups
  for select to authenticated using (public.is_admin());
create policy "waitlist_admin_update" on public.waitlist_signups
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "waitlist_admin_delete" on public.waitlist_signups
  for delete to authenticated using (public.is_admin());

grant insert on public.waitlist_signups to anon, authenticated;
grant select, update, delete on public.waitlist_signups to authenticated;

-- Take signups off the waitlist the moment they create an account.
-- Never blocks signup: failures are swallowed.
create or replace function public.handle_new_user_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    update public.waitlist_signups
       set status = 'joined',
           user_id = new.id,
           joined_at = now()
     where lower(email) = lower(new.email)
       and status in ('waiting', 'invited');
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created_waitlist on auth.users;
create trigger on_auth_user_created_waitlist
  after insert on auth.users
  for each row execute function public.handle_new_user_waitlist();
