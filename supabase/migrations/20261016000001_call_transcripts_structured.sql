-- Gemini structured transcript lives next to the flattened text so analyze-call
-- and the Transcript tab keep reading transcript_text / speaker_segments unchanged.
-- structured_turns is the source of truth; the legacy columns are derived from it.
alter table public.call_transcripts
  add column if not exists structured_turns jsonb,
  add column if not exists structured_meta  jsonb not null default '{}'::jsonb;

comment on column public.call_transcripts.structured_turns is
  'Ordered turns from Gemini: speaker (rep|customer|unknown), text, tone {label, note}, start_s, end_s, overlap. Null when only a plain transcript exists.';
comment on column public.call_transcripts.structured_meta is
  'Provenance for structured_turns: schema_version, model, language, audio_quality, speakers evidence, token usage.';
