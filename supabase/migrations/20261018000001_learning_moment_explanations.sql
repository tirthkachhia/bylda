-- Learning moments get manager-language text: a short headline (computed in code
-- from the signals) and Claude's one-sentence explanation written during analysis,
-- grounded in the playbook. Written by the service role only.
alter table public.call_learning_moments
  add column if not exists headline            text,
  add column if not exists why_it_matters      text,
  add column if not exists what_to_say_instead text,
  add column if not exists playbook_guideline  text,
  add column if not exists explained_at        timestamptz;

comment on column public.call_learning_moments.why_it_matters is
  'One sentence from analyze-call explaining the moment against the rep''s playbook. Null until analysis runs.';
