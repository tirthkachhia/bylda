-- Founder Course — post-approval personalized course, built ON the existing
-- mission spine (missions → mission_steps), NOT a parallel modules table.
--
--   module      = mission   (one per stage, owned by a mentor)
--   module step = mission_step (each points at a real, clickable in-product action)
--
-- Completion already dual-writes step.completed / mission.completed to
-- nova_events via the advance-mission edge function — this migration only adds
-- the columns the course generator and the course UI need. Everything is
-- additive and idempotent.

-- ── 1. Casefile approval state (Part 1 Q8 gap) ───────────────────────────────
-- The Founder Casefile is a score_verdict tool_run. Approval is the trigger
-- that builds the course, so it needs a durable draft/approved state. A column
-- on the run (not a new entity) keeps it the casefile of record.
alter table public.tool_runs
  add column if not exists casefile_status text
    check (casefile_status in ('draft', 'approved')),
  add column if not exists casefile_approved_at timestamptz;

-- ── 2. 'locked' mission status (course modules gate on the prior module) ──────
-- Added value is not used inside this migration, so it is safe in-transaction.
alter type public.mission_status add value if not exists 'locked';

-- ── 3. Missions become course modules ────────────────────────────────────────
alter table public.missions
  add column if not exists mentor_owner text references public.mentors(id),
  add column if not exists generated_from_casefile_id uuid
    references public.tool_runs(id) on delete set null,
  add column if not exists unlock_condition text;

create index if not exists idx_missions_casefile
  on public.missions(generated_from_casefile_id);

-- ── 4. Mission steps become course steps ─────────────────────────────────────
--   instruction     plain-language, mentor-voice copy (distinct from the
--                   terse `description`; the course UI renders this)
--   target_ui_ref   the route/component the step points at (real, clickable)
--   action_type     what the founder physically does at the target
--   completion_event which nova_events type marks it done (advance-mission
--                   already emits step.completed; this records the intent)
alter table public.mission_steps
  add column if not exists instruction text,
  add column if not exists target_ui_ref text,
  add column if not exists action_type text
    check (action_type in ('navigate', 'click', 'fill_field', 'review_output')),
  add column if not exists completion_event text;
