-- Context + Memory MVP foundation.
-- Additive, organization-scoped primitives for raw ingestion, external identity,
-- sales baselines, structured memory, entity-filtered retrieval, and context receipts.

create extension if not exists vector;

-- Deterministic phone matching for call/contact resolution.
create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), '');
$$;

alter table public.contacts add column if not exists phone_normalized text;
alter table public.leads add column if not exists phone_normalized text;

update public.contacts set phone_normalized = public.normalize_phone(phone)
where phone_normalized is distinct from public.normalize_phone(phone);
update public.leads set phone_normalized = public.normalize_phone(phone)
where phone_normalized is distinct from public.normalize_phone(phone);

create or replace function public.set_normalized_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone_normalized := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_contacts_normalize_phone on public.contacts;
create trigger trg_contacts_normalize_phone
  before insert or update of phone on public.contacts
  for each row execute function public.set_normalized_phone();

drop trigger if exists trg_leads_normalize_phone on public.leads;
create trigger trg_leads_normalize_phone
  before insert or update of phone on public.leads
  for each row execute function public.set_normalized_phone();

create index if not exists idx_contacts_org_phone_normalized
  on public.contacts(org_id, phone_normalized)
  where phone_normalized is not null;
create index if not exists idx_leads_org_phone_normalized
  on public.leads(organization_id, phone_normalized)
  where phone_normalized is not null;

-- Members need to be able to read shared contact context even though legacy
-- contact mutation remains owner-scoped.
drop policy if exists "contacts_org_member_select" on public.contacts;
create policy "contacts_org_member_select" on public.contacts
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));

-- Raw provider payloads are retained so normalization can be replayed.
create table if not exists public.integration_raw_objects (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  provider           text not null,
  external_object_type text not null,
  external_object_id text,
  idempotency_key    text not null,
  payload_hash       text not null,
  payload            jsonb not null,
  processing_status  text not null default 'received'
                       check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  canonical_type     text,
  canonical_id       uuid,
  error_message      text,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (organization_id, provider, external_object_type, idempotency_key)
);

create index if not exists idx_integration_raw_org_received
  on public.integration_raw_objects(organization_id, received_at desc);
create index if not exists idx_integration_raw_processing
  on public.integration_raw_objects(processing_status, received_at);

alter table public.integration_raw_objects enable row level security;
drop policy if exists "integration_raw_select_member" on public.integration_raw_objects;
create policy "integration_raw_select_member" on public.integration_raw_objects
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

-- One provider identity maps deterministically to one canonical Bylda object.
create table if not exists public.integration_external_objects (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  provider             text not null,
  external_object_type text not null,
  external_object_id   text not null,
  canonical_type       text not null
                         check (canonical_type in ('company', 'contact', 'lead', 'call')),
  canonical_id         uuid not null,
  external_updated_at  timestamptz,
  sync_version         bigint not null default 1,
  last_synced_at       timestamptz not null default now(),
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organization_id, provider, external_object_type, external_object_id)
);

create index if not exists idx_external_objects_canonical
  on public.integration_external_objects(organization_id, canonical_type, canonical_id);

drop trigger if exists trg_external_objects_updated on public.integration_external_objects;
create trigger trg_external_objects_updated
  before update on public.integration_external_objects
  for each row execute function public.set_updated_at();

alter table public.integration_external_objects enable row level security;
drop policy if exists "external_objects_select_member" on public.integration_external_objects;
create policy "external_objects_select_member" on public.integration_external_objects
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.validate_external_object_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.canonical_type = 'company' and not exists (
    select 1 from public.companies
    where id = new.canonical_id and organization_id = new.organization_id
  ) then
    raise exception 'External company mapping crosses organization boundary';
  elsif new.canonical_type = 'contact' and not exists (
    select 1 from public.contacts
    where id = new.canonical_id and org_id = new.organization_id
  ) then
    raise exception 'External contact mapping crosses organization boundary';
  elsif new.canonical_type = 'lead' and not exists (
    select 1 from public.leads
    where id = new.canonical_id and organization_id = new.organization_id
  ) then
    raise exception 'External lead mapping crosses organization boundary';
  elsif new.canonical_type = 'call' and not exists (
    select 1 from public.calls
    where id = new.canonical_id and organization_id = new.organization_id
  ) then
    raise exception 'External call mapping crosses organization boundary';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_external_object_scope on public.integration_external_objects;
create trigger trg_validate_external_object_scope
  before insert or update of organization_id, canonical_type, canonical_id
  on public.integration_external_objects
  for each row execute function public.validate_external_object_scope();

create or replace function public.cleanup_context_entity_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_kind text := tg_argv[0];
  org_column text := tg_argv[1];
  old_json jsonb := to_jsonb(old);
  new_json jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_org uuid := (old_json ->> org_column)::uuid;
  new_org uuid := case when new_json is null then null else (new_json ->> org_column)::uuid end;
begin
  if tg_op = 'DELETE' or old_org is distinct from new_org then
    delete from public.integration_external_objects
    where organization_id = old_org
      and canonical_type = entity_kind
      and canonical_id = old.id;
    delete from public.entity_memory_facts
    where organization_id = old_org
      and entity_type = entity_kind
      and entity_id = old.id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_cleanup_company_context_refs on public.companies;
create trigger trg_cleanup_company_context_refs
  after delete or update of organization_id on public.companies
  for each row execute function public.cleanup_context_entity_references('company', 'organization_id');
drop trigger if exists trg_cleanup_contact_context_refs on public.contacts;
create trigger trg_cleanup_contact_context_refs
  after delete or update of org_id on public.contacts
  for each row execute function public.cleanup_context_entity_references('contact', 'org_id');
drop trigger if exists trg_cleanup_lead_context_refs on public.leads;
create trigger trg_cleanup_lead_context_refs
  after delete or update of organization_id on public.leads
  for each row execute function public.cleanup_context_entity_references('lead', 'organization_id');
drop trigger if exists trg_cleanup_call_context_refs on public.calls;
create trigger trg_cleanup_call_context_refs
  after delete or update of organization_id on public.calls
  for each row execute function public.cleanup_context_entity_references('call', 'organization_id');

create or replace function public.prevent_context_entity_org_move()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Canonical CRM entities cannot move between organizations';
end;
$$;

drop trigger if exists trg_prevent_company_org_move on public.companies;
create trigger trg_prevent_company_org_move
  before update of organization_id on public.companies
  for each row
  when (old.organization_id is distinct from new.organization_id)
  execute function public.prevent_context_entity_org_move();
drop trigger if exists trg_prevent_contact_org_move on public.contacts;
create trigger trg_prevent_contact_org_move
  before update of org_id on public.contacts
  for each row
  when (old.org_id is distinct from new.org_id)
  execute function public.prevent_context_entity_org_move();
drop trigger if exists trg_prevent_lead_org_move on public.leads;
create trigger trg_prevent_lead_org_move
  before update of organization_id on public.leads
  for each row
  when (old.organization_id is distinct from new.organization_id)
  execute function public.prevent_context_entity_org_move();
drop trigger if exists trg_prevent_call_org_move on public.calls;
create trigger trg_prevent_call_org_move
  before update of organization_id on public.calls
  for each row
  when (old.organization_id is distinct from new.organization_id)
  execute function public.prevent_context_entity_org_move();

create or replace function public.validate_transcript_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.calls
    where id = new.call_id and organization_id = new.organization_id
  ) then
    raise exception 'Transcript call crosses organization boundary';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_transcript_scope on public.call_transcripts;
create trigger trg_validate_transcript_scope
  before insert or update of call_id, organization_id on public.call_transcripts
  for each row execute function public.validate_transcript_scope();
drop trigger if exists trg_prevent_transcript_org_move on public.call_transcripts;
create trigger trg_prevent_transcript_org_move
  before update of organization_id on public.call_transcripts
  for each row
  when (old.organization_id is distinct from new.organization_id)
  execute function public.prevent_context_entity_org_move();
drop trigger if exists trg_prevent_transcript_call_move on public.call_transcripts;
create trigger trg_prevent_transcript_call_move
  before update of call_id on public.call_transcripts
  for each row
  when (old.call_id is distinct from new.call_id)
  execute function public.prevent_context_entity_org_move();

-- Versioned organization sales baseline. Only one active version is allowed.
create table if not exists public.sales_baselines (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  version           integer not null,
  status            text not null default 'draft'
                      check (status in ('draft', 'active', 'superseded')),
  profile           jsonb not null default '{}',
  provenance        jsonb not null default '[]',
  reason_for_change text,
  effective_from    timestamptz not null default now(),
  effective_to      timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, version)
);

create unique index if not exists uq_sales_baseline_active
  on public.sales_baselines(organization_id)
  where status = 'active';

drop trigger if exists trg_sales_baselines_updated on public.sales_baselines;
create trigger trg_sales_baselines_updated
  before update on public.sales_baselines
  for each row execute function public.set_updated_at();

alter table public.sales_baselines enable row level security;

create or replace function public.can_manage_context(_org_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id
      and user_id = _user_id
      and role::text in ('owner', 'admin')
  );
$$;

drop policy if exists "sales_baselines_select_member" on public.sales_baselines;
create policy "sales_baselines_select_member" on public.sales_baselines
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
drop policy if exists "sales_baselines_manage_owner" on public.sales_baselines;
create policy "sales_baselines_manage_owner" on public.sales_baselines
  for all to authenticated
  using (public.can_manage_context(organization_id, auth.uid()))
  with check (public.can_manage_context(organization_id, auth.uid()));

-- Durable, queryable entity memory. Source truth and model-derived memory remain
-- explicitly classified instead of being merged into one prose summary.
create table if not exists public.entity_memory_facts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  entity_type       text not null
                      check (entity_type in ('organization', 'company', 'contact', 'lead', 'user')),
  entity_id         uuid not null,
  fact_key          text not null,
  fact_value        jsonb not null,
  fact_class        text not null
                      check (fact_class in ('external_truth', 'observed_fact', 'derived_fact', 'user_correction')),
  source_type       text not null,
  source_id         uuid,
  confidence        numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence          jsonb not null default '[]',
  valid_from        timestamptz not null default now(),
  valid_to          timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_entity_memory_current
  on public.entity_memory_facts(organization_id, entity_type, entity_id, fact_key)
  where valid_to is null;

alter table public.entity_memory_facts enable row level security;
drop policy if exists "entity_memory_select_member" on public.entity_memory_facts;
create policy "entity_memory_select_member" on public.entity_memory_facts
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.validate_entity_memory_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.entity_type = 'organization' and new.entity_id <> new.organization_id then
    raise exception 'Organization memory entity does not match organization';
  elsif new.entity_type = 'company' and not exists (
    select 1 from public.companies
    where id = new.entity_id and organization_id = new.organization_id
  ) then
    raise exception 'Memory company crosses organization boundary';
  elsif new.entity_type = 'contact' and not exists (
    select 1 from public.contacts
    where id = new.entity_id and org_id = new.organization_id
  ) then
    raise exception 'Memory contact crosses organization boundary';
  elsif new.entity_type = 'lead' and not exists (
    select 1 from public.leads
    where id = new.entity_id and organization_id = new.organization_id
  ) then
    raise exception 'Memory lead crosses organization boundary';
  elsif new.entity_type = 'user' and not exists (
    select 1 from public.organization_members
    where user_id = new.entity_id and organization_id = new.organization_id
  ) then
    raise exception 'Memory user is not an organization member';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_entity_memory_scope on public.entity_memory_facts;
create trigger trg_validate_entity_memory_scope
  before insert or update of organization_id, entity_type, entity_id
  on public.entity_memory_facts
  for each row execute function public.validate_entity_memory_scope();

-- Entity-filtered semantic evidence. Embeddings are optional locally; the same
-- rows provide deterministic recency retrieval when no embedding key is set.
create table if not exists public.context_memory_chunks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  source_type      text not null,
  source_id        uuid,
  transcript_id    uuid references public.call_transcripts(id) on delete cascade,
  company_id       uuid references public.companies(id) on delete set null,
  contact_id       uuid references public.contacts(id) on delete set null,
  lead_id          uuid references public.leads(id) on delete set null,
  call_id          uuid references public.calls(id) on delete cascade,
  chunk_index      integer not null default 0,
  content          text not null,
  token_count      integer,
  metadata         jsonb not null default '{}',
  embedding        vector(1536),
  embedding_model  text,
  occurred_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (organization_id, source_type, source_id, chunk_index)
);

create index if not exists idx_context_memory_org_time
  on public.context_memory_chunks(organization_id, occurred_at desc);
create index if not exists idx_context_memory_lead
  on public.context_memory_chunks(organization_id, lead_id, occurred_at desc);
create index if not exists idx_context_memory_contact
  on public.context_memory_chunks(organization_id, contact_id, occurred_at desc);
create index if not exists idx_context_memory_company
  on public.context_memory_chunks(organization_id, company_id, occurred_at desc);
create index if not exists idx_context_memory_call
  on public.context_memory_chunks(organization_id, call_id, occurred_at desc);
create index if not exists idx_context_memory_embedding
  on public.context_memory_chunks using hnsw (embedding vector_cosine_ops);

alter table public.context_memory_chunks enable row level security;
drop policy if exists "context_memory_select_member" on public.context_memory_chunks;
create policy "context_memory_select_member" on public.context_memory_chunks
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.validate_context_memory_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id is not null and not exists (
    select 1 from public.companies
    where id = new.company_id and organization_id = new.organization_id
  ) then
    raise exception 'Context company crosses organization boundary';
  end if;
  if new.contact_id is not null and not exists (
    select 1 from public.contacts
    where id = new.contact_id and org_id = new.organization_id
  ) then
    raise exception 'Context contact crosses organization boundary';
  end if;
  if new.lead_id is not null and not exists (
    select 1 from public.leads
    where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'Context lead crosses organization boundary';
  end if;
  if new.call_id is not null and not exists (
    select 1 from public.calls
    where id = new.call_id and organization_id = new.organization_id
  ) then
    raise exception 'Context call crosses organization boundary';
  end if;
  if new.transcript_id is not null and not exists (
    select 1 from public.call_transcripts
    where id = new.transcript_id and organization_id = new.organization_id
  ) then
    raise exception 'Context transcript crosses organization boundary';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_context_memory_scope on public.context_memory_chunks;
create trigger trg_validate_context_memory_scope
  before insert or update of organization_id, company_id, contact_id, lead_id, call_id, transcript_id
  on public.context_memory_chunks
  for each row execute function public.validate_context_memory_scope();

create or replace function public.match_context_memory(
  query_embedding vector(1536),
  filter_organization_id uuid,
  filter_company_id uuid default null,
  filter_contact_id uuid default null,
  filter_lead_id uuid default null,
  filter_call_id uuid default null,
  exclude_call_id uuid default null,
  match_count integer default 8
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  source_type text,
  source_id uuid,
  occurred_at timestamptz,
  similarity float
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);
  perform set_config('hnsw.ef_search', '100', true);
  return query
  select
    cmc.id,
    cmc.content,
    cmc.metadata,
    cmc.source_type,
    cmc.source_id,
    cmc.occurred_at,
    1 - (cmc.embedding <=> query_embedding) as similarity
  from public.context_memory_chunks cmc
  where cmc.organization_id = filter_organization_id
    and cmc.embedding is not null
    and (filter_company_id is null or cmc.company_id = filter_company_id)
    and (filter_contact_id is null or cmc.contact_id = filter_contact_id)
    and (filter_lead_id is null or cmc.lead_id = filter_lead_id)
    and (filter_call_id is null or cmc.call_id = filter_call_id)
    and (exclude_call_id is null or cmc.call_id is distinct from exclude_call_id)
  order by cmc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 30));
end;
$$;

create or replace function public.store_call_transcript_memory(
  p_organization_id uuid,
  p_call_id uuid,
  p_contact_id uuid,
  p_lead_id uuid,
  p_company_id uuid,
  p_transcript_text text,
  p_speaker_segments jsonb,
  p_transcript_hash text,
  p_chunks jsonb,
  p_occurred_at timestamptz
)
returns table (transcript_id uuid, transcript_changed boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_transcript_id uuid;
  previous_hash text;
  linked_chunk_count integer;
  content_changed boolean;
begin
  perform 1 from public.calls
  where id = p_call_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Call does not belong to the requested organization';
  end if;

  if encode(digest(p_transcript_text, 'sha256'), 'hex') <> p_transcript_hash then
    raise exception 'Transcript hash does not match transcript content';
  end if;

  select id, encode(digest(coalesce(transcript_text, ''), 'sha256'), 'hex')
    into stored_transcript_id, previous_hash
  from public.call_transcripts
  where call_id = p_call_id;

  insert into public.call_transcripts (
    call_id, organization_id, transcript_text, speaker_segments
  )
  values (
    p_call_id, p_organization_id, p_transcript_text, coalesce(p_speaker_segments, '[]'::jsonb)
  )
  on conflict (call_id) do update
    set transcript_text = excluded.transcript_text,
        speaker_segments = excluded.speaker_segments
  returning id into stored_transcript_id;

  content_changed := previous_hash is distinct from p_transcript_hash;
  if not content_changed then
    update public.context_memory_chunks
    set company_id = p_company_id,
        contact_id = p_contact_id,
        lead_id = p_lead_id,
        call_id = p_call_id,
        occurred_at = p_occurred_at
    where organization_id = p_organization_id
      and source_type = 'call_transcript'
      and source_id = stored_transcript_id;
    get diagnostics linked_chunk_count = row_count;
    if linked_chunk_count = jsonb_array_length(p_chunks) then
      return query select stored_transcript_id, false;
      return;
    end if;
  end if;

  delete from public.context_memory_chunks
  where organization_id = p_organization_id
    and source_type = 'call_transcript'
    and source_id = stored_transcript_id;

  insert into public.context_memory_chunks (
    organization_id, source_type, source_id, transcript_id, company_id,
    contact_id, lead_id, call_id, chunk_index, content, token_count,
    metadata, occurred_at
  )
  select
    p_organization_id,
    'call_transcript',
    stored_transcript_id,
    stored_transcript_id,
    p_company_id,
    p_contact_id,
    p_lead_id,
    p_call_id,
    (chunk ->> 'chunk_index')::integer,
    chunk ->> 'content',
    (chunk ->> 'token_count')::integer,
    coalesce(chunk -> 'metadata', '{}'::jsonb),
    p_occurred_at
  from jsonb_array_elements(p_chunks) as chunk;

  return query select stored_transcript_id, content_changed;
end;
$$;

revoke all on function public.store_call_transcript_memory(
  uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.store_call_transcript_memory(
  uuid, uuid, uuid, uuid, uuid, text, jsonb, text, jsonb, timestamptz
) to service_role;

-- Durable analysis claims prevent webhook retries from starting duplicate model work.
create table if not exists public.call_analysis_jobs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  call_id          uuid not null references public.calls(id) on delete cascade,
  transcript_id    uuid not null references public.call_transcripts(id) on delete cascade,
  transcript_hash  text not null,
  analysis_version integer not null,
  status           text not null default 'queued'
                     check (status in ('queued', 'running', 'completed', 'failed', 'superseded')),
  attempt_count    integer not null default 1,
  attempt_token    uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz,
  error_message    text,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  unique (call_id, transcript_hash, analysis_version)
);

create index if not exists idx_call_analysis_jobs_org_status
  on public.call_analysis_jobs(organization_id, status, created_at);

alter table public.call_analysis_jobs enable row level security;
drop policy if exists "call_analysis_jobs_select_member" on public.call_analysis_jobs;
create policy "call_analysis_jobs_select_member" on public.call_analysis_jobs
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.claim_call_analysis(
  p_organization_id uuid,
  p_call_id uuid,
  p_transcript_id uuid,
  p_transcript_hash text,
  p_analysis_version integer
)
returns table (job_id uuid, attempt_token uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  claimed_id uuid;
  claimed_token uuid;
begin
  if not exists (
    select 1 from public.call_transcripts
    where id = p_transcript_id and call_id = p_call_id
      and organization_id = p_organization_id
      and encode(digest(coalesce(transcript_text, ''), 'sha256'), 'hex') = p_transcript_hash
  ) then
    raise exception 'Transcript snapshot does not belong to call and organization';
  end if;

  insert into public.call_analysis_jobs (
    organization_id, call_id, transcript_id, transcript_hash, analysis_version,
    status, lease_expires_at
  )
  values (
    p_organization_id, p_call_id, p_transcript_id, p_transcript_hash,
    p_analysis_version, 'queued', now() + interval '5 minutes'
  )
  on conflict (call_id, transcript_hash, analysis_version) do update
    set status = 'queued',
        transcript_id = excluded.transcript_id,
        attempt_count = public.call_analysis_jobs.attempt_count + 1,
        attempt_token = gen_random_uuid(),
        lease_expires_at = now() + interval '5 minutes',
        error_message = null,
        started_at = null,
        completed_at = null
    where public.call_analysis_jobs.status = 'failed'
       or (
         public.call_analysis_jobs.status in ('queued', 'running')
         and public.call_analysis_jobs.lease_expires_at < now()
       )
  returning id, public.call_analysis_jobs.attempt_token
    into claimed_id, claimed_token;

  return query select claimed_id, claimed_token;
end;
$$;

revoke all on function public.claim_call_analysis(uuid, uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_call_analysis(uuid, uuid, uuid, text, integer)
  to service_role;

create or replace function public.acquire_call_analysis(
  p_job_id uuid,
  p_attempt_token uuid,
  p_organization_id uuid,
  p_call_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  acquired boolean := false;
begin
  update public.call_analysis_jobs job
  set status = 'running',
      started_at = now(),
      lease_expires_at = now() + interval '5 minutes'
  from public.call_transcripts transcript
  where job.id = p_job_id
    and job.organization_id = p_organization_id
    and job.call_id = p_call_id
    and job.attempt_token = p_attempt_token
    and job.status = 'queued'
    and transcript.id = job.transcript_id
    and transcript.call_id = job.call_id
    and transcript.organization_id = job.organization_id
    and encode(digest(coalesce(transcript.transcript_text, ''), 'sha256'), 'hex')
      = job.transcript_hash;
  acquired := found;
  return acquired;
end;
$$;

revoke all on function public.acquire_call_analysis(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.acquire_call_analysis(uuid, uuid, uuid, uuid)
  to service_role;

alter table public.call_insights
  add column if not exists context_receipt jsonb not null default '{}',
  add column if not exists context_version bigint,
  add column if not exists transcript_hash text;

create or replace function public.complete_call_analysis(
  p_job_id uuid,
  p_attempt_token uuid,
  p_organization_id uuid,
  p_call_id uuid,
  p_transcript_id uuid,
  p_transcript_hash text,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_hash text;
begin
  if p_job_id is not null and not exists (
    select 1 from public.call_analysis_jobs
    where id = p_job_id
      and attempt_token = p_attempt_token
      and organization_id = p_organization_id
      and call_id = p_call_id
      and transcript_id = p_transcript_id
      and transcript_hash = p_transcript_hash
      and analysis_version = 2
      and status = 'running'
    for update
  ) then
    return false;
  end if;

  select encode(digest(coalesce(transcript_text, ''), 'sha256'), 'hex')
    into current_hash
  from public.call_transcripts
  where id = p_transcript_id
    and call_id = p_call_id
    and organization_id = p_organization_id
  for update;

  if current_hash is null or current_hash <> p_transcript_hash then
    if p_job_id is not null then
      update public.call_analysis_jobs
      set status = 'superseded',
          error_message = 'Transcript changed during analysis',
          completed_at = now()
      where id = p_job_id and attempt_token = p_attempt_token;
    end if;
    return false;
  end if;

  insert into public.call_insights (
    call_id,
    organization_id,
    objections,
    competitor_mentions,
    talk_ratio,
    next_steps_extracted,
    summary,
    sales_profile,
    vertical_insights,
    crm_writeback_preview,
    missing_required_fields,
    analysis_version,
    context_receipt,
    context_version,
    transcript_hash,
    writeback_status,
    approved_at,
    approved_by
  )
  values (
    p_call_id,
    p_organization_id,
    coalesce(p_result -> 'objections', '[]'::jsonb),
    coalesce(p_result -> 'competitor_mentions', '[]'::jsonb),
    nullif(p_result ->> 'talk_ratio', '')::numeric,
    coalesce(p_result -> 'next_steps_extracted', '[]'::jsonb),
    nullif(p_result ->> 'summary', ''),
    coalesce(nullif(p_result ->> 'sales_profile', ''), 'generic'),
    coalesce(p_result -> 'vertical_insights', '{}'::jsonb),
    coalesce(p_result -> 'crm_writeback_preview', '[]'::jsonb),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(p_result -> 'missing_required_fields', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce((p_result ->> 'analysis_version')::integer, 2),
    coalesce(p_result -> 'context_receipt', '{}'::jsonb),
    nullif(p_result ->> 'context_version', '')::bigint,
    p_transcript_hash,
    'pending_review',
    null,
    null
  )
  on conflict (call_id) do update
    set organization_id = excluded.organization_id,
        objections = excluded.objections,
        competitor_mentions = excluded.competitor_mentions,
        talk_ratio = excluded.talk_ratio,
        next_steps_extracted = excluded.next_steps_extracted,
        summary = excluded.summary,
        sales_profile = excluded.sales_profile,
        vertical_insights = excluded.vertical_insights,
        crm_writeback_preview = excluded.crm_writeback_preview,
        missing_required_fields = excluded.missing_required_fields,
        analysis_version = excluded.analysis_version,
        context_receipt = excluded.context_receipt,
        context_version = excluded.context_version,
        transcript_hash = excluded.transcript_hash,
        writeback_status = excluded.writeback_status,
        approved_at = null,
        approved_by = null;

  delete from public.mentor_insights
  where org_id = p_organization_id
    and agent_id = 'mo-latif'
    and n8n_run_id = 'call:' || p_call_id::text;
  if jsonb_typeof(p_result -> 'mentor_insight') = 'object' then
    insert into public.mentor_insights (
      org_id, agent_id, type, title, detail, priority, n8n_run_id
    )
    values (
      p_organization_id,
      coalesce(nullif(p_result #>> '{mentor_insight,agent_id}', ''), 'mo-latif'),
      coalesce(nullif(p_result #>> '{mentor_insight,type}', ''), 'signal'),
      coalesce(nullif(p_result #>> '{mentor_insight,title}', ''), 'Call intelligence'),
      coalesce(p_result #>> '{mentor_insight,detail}', ''),
      coalesce(nullif(p_result #>> '{mentor_insight,priority}', ''), 'medium'),
      'call:' || p_call_id::text
    );
  end if;

  if p_result ? 'sentiment_score'
     and jsonb_typeof(p_result -> 'sentiment_score') = 'number' then
    update public.call_transcripts
    set sentiment_score = (p_result ->> 'sentiment_score')::numeric
    where id = p_transcript_id;
  end if;

  if p_job_id is not null then
    update public.call_analysis_jobs
    set status = 'completed',
        completed_at = now(),
        lease_expires_at = null,
        error_message = null
    where id = p_job_id and attempt_token = p_attempt_token;
  end if;
  return true;
end;
$$;

revoke all on function public.complete_call_analysis(
  uuid, uuid, uuid, uuid, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_call_analysis(
  uuid, uuid, uuid, uuid, uuid, text, jsonb
) to service_role;

-- Context freshness and observability.
create table if not exists public.context_versions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  version         bigint not null default 1,
  last_reason     text,
  updated_at      timestamptz not null default now()
);

alter table public.context_versions enable row level security;
drop policy if exists "context_versions_select_member" on public.context_versions;
create policy "context_versions_select_member" on public.context_versions
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create table if not exists public.context_package_runs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  requested_by      uuid references auth.users(id) on delete set null,
  task              text not null,
  entity_type       text,
  entity_id         uuid,
  context_version   bigint not null,
  source_references jsonb not null default '[]',
  omissions         jsonb not null default '[]',
  token_estimate    integer not null default 0,
  latency_ms        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index if not exists idx_context_package_runs_org_time
  on public.context_package_runs(organization_id, created_at desc);

alter table public.context_package_runs enable row level security;
drop policy if exists "context_package_runs_select_member" on public.context_package_runs;
create policy "context_package_runs_select_member" on public.context_package_runs
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

create or replace function public.bump_context_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_json jsonb;
  target_org uuid;
begin
  record_json := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_org := coalesce(
    nullif(record_json ->> 'organization_id', '')::uuid,
    nullif(record_json ->> 'org_id', '')::uuid
  );
  if target_org is not null and exists (
    select 1 from public.organizations where id = target_org
  ) then
    insert into public.context_versions(organization_id, version, last_reason, updated_at)
    values (target_org, 1, tg_table_name || '.' || lower(tg_op), now())
    on conflict (organization_id) do update
      set version = public.context_versions.version + 1,
          last_reason = excluded.last_reason,
          updated_at = now();
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_context_version_business_context on public.business_context;
create trigger trg_context_version_business_context
  after insert or update or delete on public.business_context
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_companies on public.companies;
create trigger trg_context_version_companies
  after insert or update or delete on public.companies
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_contacts on public.contacts;
create trigger trg_context_version_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_leads on public.leads;
create trigger trg_context_version_leads
  after insert or update or delete on public.leads
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_calls on public.calls;
create trigger trg_context_version_calls
  after insert or update or delete on public.calls
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_transcripts on public.call_transcripts;
create trigger trg_context_version_transcripts
  after insert or update or delete on public.call_transcripts
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_memory_artifacts on public.memory_artifacts;
create trigger trg_context_version_memory_artifacts
  after insert or update or delete on public.memory_artifacts
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_sales_baselines on public.sales_baselines;
create trigger trg_context_version_sales_baselines
  after insert or update or delete on public.sales_baselines
  for each row execute function public.bump_context_version();
drop trigger if exists trg_context_version_entity_memory on public.entity_memory_facts;
create trigger trg_context_version_entity_memory
  after insert or update or delete on public.entity_memory_facts
  for each row execute function public.bump_context_version();

-- Idempotent event keys and context receipts for call intelligence.
alter table public.bylda_events add column if not exists event_key text;
alter table public.bylda_events add column if not exists version integer not null default 1;
create unique index if not exists uq_bylda_events_org_event_key
  on public.bylda_events(organization_id, event_key);

alter table public.call_insights add column if not exists context_receipt jsonb not null default '{}';
alter table public.call_insights add column if not exists context_version bigint;
