create table if not exists public.coaching_ask_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_key text not null,
  question text not null check(length(question) between 1 and 2000),
  answer text not null,
  citations jsonb not null check(jsonb_typeof(citations)='array'),
  call_ids uuid[] not null,
  created_at timestamptz not null default now()
);
create index if not exists coaching_ask_history_scope on public.coaching_ask_history(user_id,organization_id,scope_key,created_at desc);
alter table public.coaching_ask_history enable row level security;
drop policy if exists own_authorized_ask_history on public.coaching_ask_history;
create policy own_authorized_ask_history on public.coaching_ask_history for select to authenticated
using(user_id=auth.uid() and public.is_org_member(organization_id,auth.uid())
  and public.coaching_session_verified() and not exists(
    select 1 from unnest(call_ids) as source(call_id) where not public.coaching_can_view_call(organization_id,source.call_id)
  ));
revoke all on public.coaching_ask_history from public,anon,authenticated;
grant select on public.coaching_ask_history to authenticated;
grant all on public.coaching_ask_history to service_role;
