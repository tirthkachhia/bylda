-- ── Team management: list org members with their profile info ────────────────
-- profiles RLS restricts SELECT to the row owner, so a member cannot read a
-- teammate's name/email directly. This SECURITY DEFINER function returns the
-- member roster for an org *only* to callers who belong to that org (the
-- is_org_member guard short-circuits to an empty set otherwise). Role changes
-- and removals continue to go through the existing organization_members RLS
-- policies (owner/admin write, self/owner delete).

create or replace function public.list_org_members(_org_id uuid)
returns table (
  user_id    uuid,
  role       public.org_role,
  full_name  text,
  email      text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.role, p.full_name, p.email, m.created_at
  from public.organization_members m
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = _org_id
    and public.is_org_member(_org_id, auth.uid())
  order by m.created_at;
$$;

revoke all on function public.list_org_members(uuid) from public, anon;
grant execute on function public.list_org_members(uuid) to authenticated;
