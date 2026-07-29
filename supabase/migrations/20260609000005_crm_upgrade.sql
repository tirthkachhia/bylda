-- ── CRM upgrade: probability, close_date, company on leads ──────────
alter table public.leads
  add column if not exists company     text,
  add column if not exists probability smallint not null default 20,
  add column if not exists close_date  date;

alter table public.leads
  drop constraint if exists leads_probability_check;
alter table public.leads
  add constraint leads_probability_check check (probability between 0 and 100);

-- ── contact_notes: per-contact notes timeline ────────────────────────
create table if not exists public.contact_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
alter table public.contact_notes enable row level security;

drop policy if exists "contact_notes_owner" on public.contact_notes;
create policy "contact_notes_owner" on public.contact_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_contact_notes_contact on public.contact_notes(contact_id);
create index if not exists idx_contact_notes_user    on public.contact_notes(user_id);
