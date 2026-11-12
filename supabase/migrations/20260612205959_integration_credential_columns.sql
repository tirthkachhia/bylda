-- Production renamed these columns outside migration history. Capture the
-- canonical text/base64 schema before the integration-save and OAuth migrations
-- reference it, while preserving the squash's legacy data on a clean replay.
alter table public.user_integrations
  add column if not exists encrypted_value text,
  add column if not exists value_hint text;

do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_integrations' and column_name='value_encrypted') then
   execute 'update public.user_integrations set encrypted_value=encode(value_encrypted,''base64'') where encrypted_value is null and value_encrypted is not null';
 end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_integrations' and column_name='value_last4') then
   execute 'update public.user_integrations set value_hint=value_last4 where value_hint is null and value_last4 is not null';
 end if;
end $$;
