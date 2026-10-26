-- Where a learning moment's cited guideline came from: the manager's playbook
-- (verified against its text) or the analyzer's built-in compliance rules.
alter table public.call_learning_moments
  add column if not exists guideline_source text
    check (guideline_source in ('playbook', 'general'));

comment on column public.call_learning_moments.guideline_source is
  'playbook = the cited guideline appears in the assigned playbook text; general = a built-in rule the analyzer applies regardless of playbook.';
