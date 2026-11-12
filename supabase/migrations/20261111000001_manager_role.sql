-- Commit the enum addition before policies and invite functions use it.
alter type public.org_role add value if not exists 'manager';
