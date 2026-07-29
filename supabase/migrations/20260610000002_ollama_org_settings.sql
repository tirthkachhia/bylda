-- Ollama private AI: per-org endpoint + model configuration.
-- When set, operator/mentor calls route through the org's own Ollama instance
-- instead of cloud providers. Tool runs always stay on Anthropic (tool_use).

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ollama_endpoint  text,    -- e.g. https://your-tunnel.ngrok.io
  ADD COLUMN IF NOT EXISTS ollama_model     text     -- e.g. llama3.2, mistral, gemma2:9b
                            DEFAULT 'llama3.2';

-- Seed model catalog with common Ollama models (zero cost — local inference)
INSERT INTO public.ai_model_catalog
  (provider_name, model_id, display_name, context_window, max_output_tokens,
   cost_per_1k_input, cost_per_1k_output, supports_tool_use, supports_streaming, tier)
VALUES
  ('ollama', 'llama3.2',     'Llama 3.2 3B',   128000, 4096, 0, 0, false, true, 'fast'),
  ('ollama', 'llama3.1:8b',  'Llama 3.1 8B',   128000, 4096, 0, 0, false, true, 'fast'),
  ('ollama', 'llama3.1:70b', 'Llama 3.1 70B',  128000, 4096, 0, 0, false, true, 'standard'),
  ('ollama', 'mistral',      'Mistral 7B',      32768,  4096, 0, 0, false, true, 'fast'),
  ('ollama', 'gemma2:9b',    'Gemma 2 9B',      8192,   4096, 0, 0, false, true, 'fast'),
  ('ollama', 'qwen2.5:7b',   'Qwen 2.5 7B',    128000, 4096, 0, 0, false, true, 'fast')
ON CONFLICT (provider_name, model_id) DO NOTHING;

COMMIT;
