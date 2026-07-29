-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduled automations (trigger_schedule) actually fire
--
-- The Builder's "Scheduled Time" trigger saved and activated but nothing ever
-- executed it. active_automations.next_run_at arms schedule-triggered rows:
--   • null    → not yet armed; automation-dispatch initializes it on its next
--               per-minute pass WITHOUT firing (activation never causes a
--               surprise immediate run)
--   • <= now  → due; dispatch claims the row optimistically (update guarded on
--               the previous next_run_at value so concurrent drains fire it
--               exactly once) and invokes run-workflow
-- Presets are parsed from the template's trigger_schedule block by
-- supabase/functions/_shared/schedule.ts (mirror of src/lib/automation-schedule.ts).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.active_automations
  add column if not exists next_run_at timestamptz;

comment on column public.active_automations.next_run_at is
  'Next due time for trigger_schedule automations; null = not yet armed. Managed by automation-dispatch.';

create index if not exists idx_active_automations_due
  on public.active_automations(next_run_at)
  where is_active and trigger_type = 'trigger_schedule';
