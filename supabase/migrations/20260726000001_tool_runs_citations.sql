-- Research enrichment: persist Perplexity source URLs alongside each run
-- so the UI can render a "Sources" row. Written by the run-tool pipeline;
-- empty array for tools without research enrichment.
alter table public.tool_runs
  add column if not exists citations jsonb not null default '[]'::jsonb;

comment on column public.tool_runs.citations is
  'Source URLs from the research-enrichment step (Perplexity). Empty for non-research tools.';
