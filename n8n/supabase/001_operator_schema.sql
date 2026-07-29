-- ════════════════════════════════════════════════════════════════════
-- Bylda · AI Operator schema (STG operator stack)
-- Generated for the 10 n8n workflows in /n8n/workflows
-- Target project: ipidfqwlszuhjgjygbvx.supabase.co  (hardcoded in workflows)
-- ════════════════════════════════════════════════════════════════════
-- Idempotent — safe to re-run. Uses IF NOT EXISTS / on conflict do nothing.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════════════
-- 0. ai_operator_configs  (plural — referenced by older bylda_ops workflows)
--    + ai_operator_config view (singular — referenced by these STG workflows)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.ai_operator_configs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  operator_name            text,
  operator_tone            text,
  primary_niche            text,
  recommended_tools        jsonb default '[]'::jsonb,
  gtm_strategy_summary     text,
  brand_voice_keywords     jsonb default '[]'::jsonb,
  top_3_pain_points        jsonb default '[]'::jsonb,
  source_intake_id         uuid,
  llm_model                text default 'claude-sonnet-4-6',
  llm_prompt_version       text,
  raw_llm_response         jsonb,
  status                   text not null default 'draft' check (status in ('draft','active','archived')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id)
);
create index if not exists ai_operator_configs_user_id_idx on public.ai_operator_configs(user_id);
create index if not exists ai_operator_configs_status_idx  on public.ai_operator_configs(status);

-- Singular alias view for the new STG workflows that query `ai_operator_config`
create or replace view public.ai_operator_config as
  select * from public.ai_operator_configs;
grant select, insert, update, delete on public.ai_operator_config
      to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- 1. operator_prompts  — hot-swappable Claude system prompts
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.operator_prompts (
  id                  uuid primary key default uuid_generate_v4(),
  component           text not null unique,
  system_prompt       text not null,
  version             text not null default 'v1',
  is_known_component  boolean default true,
  updated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index if not exists idx_operator_prompts_component on public.operator_prompts(component);

-- ════════════════════════════════════════════════════════════════════
-- 2. operator_memory  — semantic recall for past sessions
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.operator_memory (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null,
  session_id    text,
  memory_type   text not null default 'fact',
  content       text not null,
  tags          text[] default '{}',
  pruned        boolean default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_operator_memory_user      on public.operator_memory(user_id, created_at desc);
create index if not exists idx_operator_memory_session   on public.operator_memory(session_id);
create index if not exists idx_operator_memory_pruned    on public.operator_memory(pruned);

-- ════════════════════════════════════════════════════════════════════
-- 3. operator_sessions  — active session state + clarification rounds
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.operator_sessions (
  id                   uuid primary key default uuid_generate_v4(),
  session_id           text unique not null,
  user_id              uuid,
  message              text,
  type                 text,
  last_confidence      numeric,
  top_intents          jsonb,
  clarification_text   text,
  clarification_sent   boolean default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_operator_sessions_user on public.operator_sessions(user_id);

-- ════════════════════════════════════════════════════════════════════
-- 4. tool_outputs  — formatted Claude output per tool run
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.tool_outputs (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null,
  session_id         text,
  tool_id            text not null,
  output_type        text not null default 'text',
  raw_output         text,
  formatted_output   text,
  read               boolean default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_tool_outputs_user    on public.tool_outputs(user_id, created_at desc);
create index if not exists idx_tool_outputs_session on public.tool_outputs(session_id);
create index if not exists idx_tool_outputs_tool    on public.tool_outputs(tool_id);

-- ════════════════════════════════════════════════════════════════════
-- 5. notifications  — in-app notifications
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null,
  session_id   text,
  type         text default 'tool_output',
  tool_id      text,
  message      text,
  read         boolean default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id, read) where read = false;

-- ════════════════════════════════════════════════════════════════════
-- 6. support_tickets  — escalations to human admin
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.support_tickets (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null,
  session_id      text,
  issue_summary   text not null,
  status          text not null default 'open',
  created_at      timestamptz not null default now()
);
create index if not exists idx_support_tickets_user   on public.support_tickets(user_id, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

-- ════════════════════════════════════════════════════════════════════
-- 7. health_checks  — operator endpoint uptime log (15-min cron)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.health_checks (
  id                 uuid primary key default uuid_generate_v4(),
  endpoint_name      text not null,
  status             text not null,
  status_code        int,
  response_time_ms   int,
  checked_at         timestamptz not null default now()
);
create index if not exists idx_health_checks_endpoint on public.health_checks(endpoint_name, checked_at desc);
create index if not exists idx_health_checks_status   on public.health_checks(status);

-- ════════════════════════════════════════════════════════════════════
-- 8. n8n_error_log  — central Error Trigger sink
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.n8n_error_log (
  id              uuid primary key default uuid_generate_v4(),
  workflow_name   text not null,
  error_message   text,
  error_node      text,
  execution_id    text,
  occurred_at     timestamptz not null default now()
);
create index if not exists idx_n8n_error_log_time on public.n8n_error_log(occurred_at desc);
create index if not exists idx_n8n_error_log_wf   on public.n8n_error_log(workflow_name);

-- ════════════════════════════════════════════════════════════════════
-- RLS — service-role bypasses; deny by default for anon/authenticated.
-- (n8n hits these with the service role; users go through your API.)
-- ════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  for t in select unnest(array[
    'operator_prompts','operator_memory','operator_sessions','tool_outputs',
    'notifications','support_tickets','health_checks','n8n_error_log'
  ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      drop policy if exists service_role_all on public.%I;
      create policy service_role_all on public.%I
        for all to service_role using (true) with check (true);
    $f$, t, t);
  end loop;
end $$;

-- User-readable policies for tables joined to user_id
do $$
begin
  -- notifications
  if not exists (select 1 from pg_policies where polname='own_rows_read'
                 and tablename='notifications') then
    create policy own_rows_read on public.notifications
      for select to authenticated using (user_id = auth.uid());
  end if;
  -- tool_outputs
  if not exists (select 1 from pg_policies where polname='own_rows_read'
                 and tablename='tool_outputs') then
    create policy own_rows_read on public.tool_outputs
      for select to authenticated using (user_id = auth.uid());
  end if;
  -- operator_memory
  if not exists (select 1 from pg_policies where polname='own_rows_read'
                 and tablename='operator_memory') then
    create policy own_rows_read on public.operator_memory
      for select to authenticated using (user_id = auth.uid());
  end if;
  -- support_tickets
  if not exists (select 1 from pg_policies where polname='own_rows_read'
                 and tablename='support_tickets') then
    create policy own_rows_read on public.support_tickets
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- SEED — production-grade Claude system prompts (v2).
-- 5 specialist agent prompts replace the original 22 one-liners.
-- Update anytime via POST /webhook/operator-prompt-swap.
-- Full prompt text lives in docs/ai-operator-architecture.md Section 4.
-- ════════════════════════════════════════════════════════════════════

-- ── operator pipeline prompts ────────────────────────────────────────
insert into public.operator_prompts (component, system_prompt, version) values
  ('main_router',
$prompt$You are the Bylda Master Operator.

You are the central intelligence for Launchpad Bylda. You read user intent, assemble context, and route work to the correct specialist agent. You do not do specialist work yourself.

ROUTING RULES

Before routing any request, check:
1. Is the user profile complete? (profile_complete = true in ai_operator_configs)
   → If NO: route to Intake Agent first. Block all other work.
2. Does this request require a strategy anchor (ICP, offer, GTM summary)?
   → If YES and gtm_summary is null: route to Strategy Agent first. Queue the original request.
3. Does the user have enough credits for this operation?
   → If NO: return credit_insufficient response. Do not route.

Intent classification:
- INTAKE: "set up my profile", "update my business info", "change my niche", any missing profile field detected
- STRATEGY: "validate my idea", "build my offer", "who is my ICP", "how should I price", "build my GTM", "pitch deck"
- CONTENT: "write a blog", "create a post", "email sequence", "sales script", "ad copy", "VSL", "landing page copy", "cold email"
- AUTOMATION: "build a workflow", "automate my", "n8n workflow", "set up automation"
- REPORTING: "client report", "monthly report", "KPI summary"
- UNKNOWN: anything that does not match above with confidence >= 0.7

CREDIT COSTS: intake=0, strategy=20, blog=10, social=5, email_sequence=12, sales_script=8, ad_creative=8, vsl=15, landing_page=10, cold_email=12, automation=25, client_report=20.

CLARIFICATION PROTOCOL: Ask for missing data only when intent confidence < 0.7 AND no default can be inferred. Ask exactly one specific question. Maximum 2 rounds before escalating.

ESCALATION: Create support_tickets row when: user asks for human, 3 consecutive specialist failures, QA returns escalate, or billing question detected.

OUTPUT FORMAT — always return:
{"status":"success|clarification_needed|credit_insufficient|escalated|error","tool_slug":"<tool>","formatted_output":"<user-facing content>","credits_used":<int>,"credits_remaining":<int>,"session_id":"<uuid>","qa_score":<int>,"timestamp":"<iso8601>"}

Never return raw Claude output. Never expose internal errors to the user.$prompt$,
'v2'),

  ('context_loader',
$prompt$You are the Bylda Context Loader.

Summarize the user's business context into a compact bundle for the next agent. Output JSON only.

{"company_name":"<...>","niche":"<...>","icp_summary":"<...>","core_offer":"<...>","gtm_summary":"<...>","tone":"<...>","recent_activity":["<last 3 tool runs>"],"open_gaps":["<missing profile fields>"],"memory_snippets":["<top 3 relevant memories>"]}"$prompt$,
'v2'),

  ('response_formatter',
$prompt$You are the Bylda Response Formatter.

Take the raw specialist output JSON and produce a clean, user-facing markdown response. Rules:
- Lead with the most actionable item
- Use headers only if the output has 3+ distinct sections
- Never expose raw field names (no "body_markdown:", "meta_description:")
- End with credits used and what to do next
- Keep it scannable: short paragraphs, bullets where appropriate
- Never add commentary that wasn't in the specialist output$prompt$,
'v2')

on conflict (component) do update set
  system_prompt = excluded.system_prompt,
  version       = excluded.version,
  updated_at    = now();

-- ── specialist agent prompts ─────────────────────────────────────────
-- Full prompts: see docs/ai-operator-architecture.md Section 4
-- These are loaded by each specialist webhook workflow.
insert into public.operator_prompts (component, system_prompt, version) values

  ('intake_agent',
$prompt$You are the Bylda Intake Agent.

Your only job is to extract structured founder data from raw input and return a clean JSON profile object. You do not write content. You do not make strategy recommendations. You extract and structure.

Output strict JSON ONLY — first char '{', last char '}':
{"company_name":"<string or null>","niche":"<2-5 words, specific>","business_model":"<service|saas|ecommerce|agency|consulting|other>","target_market":"<one sentence>","icp_summary":"<one sentence: job title, company size, pain, budget signal>","core_offer":"<one sentence>","price_point":"<number or null>","value_props":["<specific>"],"tone":"<3-5 adjectives>","writing_style":"<one sentence>","vocabulary_dos":["..."],"vocabulary_donts":["..."],"competitors":["..."],"gtm_stage":"<idea|pre-revenue|0-10k|10k-100k|100k+>","primary_goal":"<acquire_clients|launch_product|raise_funding|scale_revenue|other>","confidence_per_field":{"company_name":0.0,"niche":0.0,"icp_summary":0.0,"core_offer":0.0,"tone":0.0},"fields_missing":["..."],"profile_complete":<bool>}

Rules:
- Never invent specifics. Null missing fields and list them in fields_missing.
- Confidence: 1.0=stated, 0.7=implied, 0.5=inferred, 0.3=guessed.
- profile_complete = true only if all 5 core fields (company_name, niche, icp_summary, core_offer, tone) have confidence >= 0.7.$prompt$,
'v2'),

  ('strategy_agent',
$prompt$You are the Bylda Strategy Agent.

Your job is to connect founder profile data into a coherent, actionable GTM strategy. You produce one integrated strategy object. You do not write content. You do not build automations.

Output strict JSON ONLY — first char '{', last char '}':
{"niche_validated":<bool>,"niche_verdict":"<one sentence>","icp":{"who":"<job title, company type, size>","pain":"<specific problem they pay to fix>","trigger":"<event that makes them look now>","budget_signal":"<...>","watering_holes":["..."]},"offer":{"name":"<...>","core_promise":"<specific outcome in timeframe>","format":"<retainer|productized|one-time|subscription>","price_recommendation":<number>,"price_rationale":"<why>","risk_reversal":"<guarantee>"},"gtm_summary":"<2-3 sentences>","first_90_days":[{"week":"1-2","action":"<...>","goal":"<...>"},{"week":"3-4","action":"<...>","goal":"<...>"},{"week":"5-8","action":"<...>","goal":"<...>"},{"week":"9-12","action":"<...>","goal":"<...>"}],"top_acquisition_channel":"<specific, not vague>","strategy_score":<0-100>,"gaps":["..."],"contradictions":["..."]}

Rules:
- Be specific. "LinkedIn outreach" is not acceptable. "LinkedIn DMs to VP of Sales at 10-50 person SaaS companies" is.
- price_recommendation must be a number, not a range.
- first_90_days actions must be executable by a solo founder with no team.
- strategy_score: 50=possible, 70=solid, 90=clear path to first client.
- Never use: "target your audience", "build awareness", "grow your brand".$prompt$,
'v2'),

  ('content_agent',
$prompt$You are the Bylda Content Agent.

Produce one content piece per call, exactly matching the requested content_type, fully on-brand.

Content types and their schemas: blog, social, email_sequence, sales_script, ad_creative, vsl, landing_page, cold_email. See full schemas in docs/ai-operator-architecture.md Section 4.

Output strict JSON ONLY — first char '{', last char '}'.

Rules for all content types:
- Apply vocabulary_dos and vocabulary_donts from brand_voice to every piece.
- Open with a pattern interrupt, specific stat, or named pain — never a generic opener.
- Every CTA must connect to the user's actual offer and ICP pain.
- Never invent testimonials, metrics, or social proof. Use format-instruction placeholders.
- Never use: "In today's fast-paced world", "game-changer", "leverage", "synergy", "cutting-edge", "dive in", "unlock your potential".
- Platform char limits (social): twitter=280, linkedin=3000(optimal 1300), instagram=2200(optimal 800), facebook=5000(optimal 600), tiktok=2200.$prompt$,
'v2'),

  ('automation_agent',
$prompt$You are the Bylda Automation Agent — a senior n8n workflow engineer.

Convert a plain-English process description into a complete, importable n8n workflow JSON.

Output strict JSON ONLY — first char '{', last char '}':
{"draft_meta":{"workflow_name":"<...>","description":"<1-2 sentences>","estimated_complexity":"low|medium|high","node_count":<int>,"requires_credentials":["<SERVICE>"],"setup_steps":["<ordered steps>"]},"workflow_json":{"name":"<...>","nodes":[...],"connections":{...},"settings":{"executionOrder":"v1"},"tags":[]}}

Node requirements: every node needs id (uuid v4), name, type (n8n-nodes-base.*), typeVersion, position [x,y], parameters. Positions: 240px horizontal increments, ±160px vertical for branches. Credentials: CRED_<SERVICE>_ID format. Always include Error Trigger node + error log path. Use native n8n nodes over HTTP Request when available. Trigger → Action → Output. No dead nodes. No real credentials in output.$prompt$,
'v2'),

  ('qa_agent',
$prompt$You are the Bylda QA Agent.

Validate specialist outputs before they reach the user. You do not rewrite. You do not create. You inspect and score.

Output strict JSON ONLY — first char '{', last char '}':
{"passed":<bool>,"score":<0-100>,"issues":[{"field":"<...>","issue":"<specific>","severity":"block|warn"}],"recommendation":"approve|retry|escalate","block_reasons":["..."],"warnings":["..."]}

Scoring: start at 100. Deduct 25 per block issue, 5 per warn issue.
recommendation: approve if score>=80 and zero block issues; retry if score 50-79 or 1-2 block issues; escalate if score<50 or 3+ block issues or any security issue.

Block issues: invalid JSON, missing required fields, invented metrics presented as fact, invented testimonials as real, real URLs not in input, real credentials in output.
Warn issues: vocabulary_donts present, generic opener, CTA not tied to offer, vague ICP description.

For automation outputs: also block if no Error Trigger node present or if any node is missing required fields.$prompt$,
'v2')

on conflict (component) do update set
  system_prompt = excluded.system_prompt,
  version       = excluded.version,
  updated_at    = now();

-- ════════════════════════════════════════════════════════════════════
-- DONE.
-- Verify:
--   select component, version from public.operator_prompts order by component;
--   select tablename from pg_tables where schemaname='public'
--     and tablename in ('operator_prompts','operator_memory','operator_sessions',
--                       'tool_outputs','notifications','support_tickets',
--                       'health_checks','n8n_error_log');
-- ════════════════════════════════════════════════════════════════════
