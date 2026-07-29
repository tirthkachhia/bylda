-- Multi-model AI foundation: provider registry, model catalog, schema extensions.
-- All changes are additive and idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).

BEGIN;

-- ─── 1. Provider registry ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_providers (
  name                text PRIMARY KEY,
  display_name        text NOT NULL,
  api_base_url        text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  supports_tool_use   boolean NOT NULL DEFAULT false,
  supports_streaming  boolean NOT NULL DEFAULT false,
  supports_web_search boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_providers_public_read" ON public.ai_providers;
CREATE POLICY "ai_providers_public_read" ON public.ai_providers
  FOR SELECT USING (true);

-- ─── 2. Model catalog with cost rates ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_model_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name       text NOT NULL REFERENCES public.ai_providers(name),
  model_id            text NOT NULL,
  display_name        text NOT NULL,
  context_window      integer NOT NULL,
  max_output_tokens   integer NOT NULL,
  cost_per_1k_input   numeric(10,6) NOT NULL,
  cost_per_1k_output  numeric(10,6) NOT NULL,
  supports_tool_use   boolean NOT NULL DEFAULT false,
  supports_streaming  boolean NOT NULL DEFAULT false,
  tier                text NOT NULL DEFAULT 'standard'
                      CHECK (tier IN ('fast', 'standard', 'powerful', 'local')),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_name, model_id)
);

ALTER TABLE public.ai_model_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_model_catalog_public_read" ON public.ai_model_catalog;
CREATE POLICY "ai_model_catalog_public_read" ON public.ai_model_catalog
  FOR SELECT USING (true);

-- ─── 3. Extend existing tables ────────────────────────────────────────────

-- usage_events: add provider + real cost + routing reason
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS provider_name   text,
  ADD COLUMN IF NOT EXISTS actual_cost_usd numeric(10,6),
  ADD COLUMN IF NOT EXISTS routing_reason  text;

-- agent_runs: add provider + real cost + fix missing session_id column
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS provider_name   text,
  ADD COLUMN IF NOT EXISTS actual_cost_usd numeric(10,6),
  ADD COLUMN IF NOT EXISTS session_id      uuid;

CREATE INDEX IF NOT EXISTS idx_agent_runs_session_id
  ON public.agent_runs(session_id) WHERE session_id IS NOT NULL;

-- tool_runs: model + provider attribution
ALTER TABLE public.tool_runs
  ADD COLUMN IF NOT EXISTS model           text,
  ADD COLUMN IF NOT EXISTS provider_name   text;

-- credit_ledger: real USD cost alongside virtual credits
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS actual_cost_usd numeric(10,6),
  ADD COLUMN IF NOT EXISTS provider_name   text,
  ADD COLUMN IF NOT EXISTS model_id        text;

-- ─── 4. Seed: provider registry ───────────────────────────────────────────

INSERT INTO public.ai_providers
  (name, display_name, api_base_url, supports_tool_use, supports_streaming, supports_web_search)
VALUES
  ('anthropic',  'Anthropic Claude', 'https://api.anthropic.com/v1',                     true,  true,  false),
  ('openai',     'OpenAI GPT',       'https://api.openai.com/v1',                        true,  true,  false),
  ('grok',       'Grok by xAI',      'https://api.x.ai/v1',                              true,  true,  true),
  ('deepseek',   'DeepSeek',         'https://api.deepseek.com/v1',                      true,  true,  false),
  ('perplexity', 'Perplexity',       'https://api.perplexity.ai',                        false, true,  true),
  ('gemini',     'Google Gemini',    'https://generativelanguage.googleapis.com/v1beta', true,  true,  false),
  ('openrouter', 'OpenRouter',       'https://openrouter.ai/api/v1',                     true,  true,  false),
  ('ollama',     'Ollama (Local)',    'http://localhost:11434',                            false, true,  false)
ON CONFLICT (name) DO NOTHING;

-- ─── 5. Seed: model catalog ───────────────────────────────────────────────

INSERT INTO public.ai_model_catalog
  (provider_name, model_id, display_name, context_window, max_output_tokens,
   cost_per_1k_input, cost_per_1k_output, supports_tool_use, supports_streaming, tier)
VALUES
  ('anthropic', 'claude-haiku-4-5-20251001',                'Claude Haiku',   200000,  8192, 0.000800, 0.004000, true,  true,  'fast'),
  ('anthropic', 'claude-sonnet-4-6',                        'Claude Sonnet',  200000, 64000, 0.003000, 0.015000, true,  true,  'standard'),
  ('anthropic', 'claude-opus-4-7',                          'Claude Opus',    200000, 32000, 0.015000, 0.075000, true,  true,  'powerful'),
  ('openai',    'gpt-4o',                                   'GPT-4o',         128000, 16384, 0.005000, 0.015000, true,  true,  'standard'),
  ('openai',    'gpt-4o-mini',                              'GPT-4o Mini',    128000, 16384, 0.000150, 0.000600, true,  true,  'fast'),
  ('grok',      'grok-2',                                   'Grok 2',         131072, 32768, 0.002000, 0.010000, true,  true,  'standard'),
  ('deepseek',  'deepseek-chat',                            'DeepSeek Chat',  128000,  8192, 0.000140, 0.000280, true,  true,  'fast'),
  ('perplexity','sonar-pro',                                'Sonar Pro',      200000,  8192, 0.003000, 0.015000, false, true,  'standard'),
  ('gemini',    'gemini-2.0-flash',                         'Gemini Flash',  1000000,  8192, 0.000075, 0.000300, true,  true,  'fast'),
  ('openrouter','meta-llama/llama-3.1-70b-instruct',        'Llama 3.1 70B', 128000,   4096, 0.000350, 0.000400, false, true,  'fast')
ON CONFLICT (provider_name, model_id) DO NOTHING;

COMMIT;
