-- Tutorial video catalog. Source of truth for the tutorial video generation
-- pipeline: each row is one tutorial; video_status drives the resumable queue
-- (pending -> generating -> completed | failed).
create table if not exists public.tutorials (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  duration text not null,
  difficulty text not null check (difficulty in ('Beginner','Intermediate','Advanced')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  app_path text,
  youtube_id text,
  video_url text,
  video_thumbnail_url text,
  video_provider text,
  video_model text,
  video_job_id text,
  video_duration_seconds integer,
  video_status text not null default 'pending'
    check (video_status in ('pending','generating','completed','failed')),
  video_error text,
  video_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutorials enable row level security;

-- Catalog content: readable by everyone (including guests); writes are
-- reserved for the service role (no insert/update/delete policies).
drop policy if exists "Tutorials are readable by everyone" on public.tutorials;
create policy "Tutorials are readable by everyone"
  on public.tutorials for select
  using (true);

create index if not exists tutorials_video_status_idx on public.tutorials (video_status);
create index if not exists tutorials_category_idx on public.tutorials (category);
