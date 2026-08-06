-- One provider call must only be ingested once, even when a dialer retries its webhook.
delete from public.calls
where id in (
  select id from (
    select id, row_number() over (
      partition by organization_id, provider, provider_call_id order by created_at desc, id desc
    ) as duplicate_number
    from public.calls
    where provider is not null and provider_call_id is not null
  ) ranked
  where duplicate_number > 1
);
create unique index if not exists calls_provider_external_id
  on public.calls (organization_id, provider, provider_call_id);

-- A call has one canonical provider transcript. Reprocessing updates it in place.
delete from public.call_transcripts
where id in (
  select id from (
    select id, row_number() over (
      partition by call_id order by created_at desc, id desc
    ) as duplicate_number
    from public.call_transcripts
  ) ranked
  where duplicate_number > 1
);
create unique index if not exists call_transcripts_one_per_call
  on public.call_transcripts (call_id);
