# Bylda · n8n Workflows — Operator Stack

10 staging workflows for the Bylda AI operator system. Pasted source split into per-workflow JSON, plus the Supabase schema they expect.

## 📁 Folder layout

```
n8n/
├── README.md                       ← you are here
├── manifest.json                   ← workflow index (name, file, tags, node count)
├── workflows/                      ← 10 importable n8n workflow JSONs
├── subagents/                      ← 6 Launchpad Claude subagents
├── launchpad/                      ← 10 Launchpad tool workflows (v1/* webhooks)
├── supabase/
│   └── 001_operator_schema.sql     ← run this in Supabase SQL editor
├── audit.json                      ← raw audit (env vars, creds, tables, URLs)
└── table_columns.json              ← columns referenced per Supabase table
```

> **Launchpad tool workflows** (10 product-facing tools — Niche Validator,
> Offer Builder, ICP Builder, Pitch Deck Outliner, Landing Page Copy,
> Pricing Strategist, VSL Generator, Lead Magnet Builder, Cold Email
> Sequencer, Ad Creative Generator) live in `launchpad/`. See
> `launchpad/README.md` for env-var setup and import order. Frontend
> wrappers are in `src/lib/launchpadTools.ts`.

## 🎯 Workflows (all start `active: false` — flip on after setup)

| #   | Workflow                       | Trigger                                        | Purpose                                                              |
| --- | ------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| 01  | AI Operator Main Router        | `POST /webhook/ai-operator-router`             | Front door · checks credits · classifies intent · routes to subagent |
| 02  | AI Operator Context Loader     | `POST /webhook/ai-operator-context-loader`     | Loads user profile + onboarding + memory for the next agent          |
| 03  | AI Operator Tool Dispatcher    | `POST /webhook/ai-operator-tool-dispatcher`    | Runs the right tool for the classified intent                        |
| 04  | AI Operator Response Formatter | `POST /webhook/ai-operator-response-formatter` | Cleans Claude output, writes `tool_outputs` + `notifications`        |
| 05  | Operator Memory Write          | `POST /webhook/operator-memory-write`          | Inserts into `operator_memory`                                       |
| 06  | Operator Memory Read           | `POST /webhook/operator-memory-read`           | Selects memories by `user_id` for context                            |
| 07  | Operator Confidence Fallback   | `POST /webhook/operator-confidence-fallback`   | If router confidence is low, asks one clarifying question            |
| 08  | Operator Escalation to Human   | `POST /webhook/operator-escalation`            | Inserts `support_tickets`, posts Slack, emails user                  |
| 09  | Operator Health Check          | Schedule · every 15 min                        | Pings critical endpoints, logs `health_checks`, alerts Slack         |
| 10  | Operator Prompt Swap           | `POST /webhook/operator-prompt-swap`           | Admin-only · upserts `operator_prompts` for hot-swap                 |

---

## ✅ Manual setup (do these BEFORE flipping any workflow active)

### 1. Supabase — run the schema

Open the Supabase project hardcoded in the workflows
(`https://ipidfqwlszuhjgjygbvx.supabase.co`) → **SQL Editor** → paste
`supabase/001_operator_schema.sql` → Run.

This creates:

- **Operator core**: `operator_prompts`, `operator_memory`, `operator_sessions`, `tool_outputs`, `notifications`, `support_tickets`, `health_checks`, `n8n_error_log`
- **Read-only scaffolds** (skip if your platform already has them): `ai_operator_config`, `plan_entitlements`, `tool_runs`, `profiles`, `onboarding_responses`
- **RLS**: service-role bypass + read-own-rows for authenticated users
- **Seeds**: 22 default Claude prompts (so workflow 10 isn't required day 1) + 4 plan tiers (`free` / `49` / `149` / `299`)

> ⚠️ The Supabase URL `ipidfqwlszuhjgjygbvx` isn't in your connected
> Supabase organisation. Either (a) connect the org that owns it, or
> (b) point the workflows at a project you own — search/replace
> `ipidfqwlszuhjgjygbvx.supabase.co` across all `workflows/*.json`
> with your actual project ref.

### 2. n8n — create credentials (Settings → Credentials)

| Cred name (must match exactly) | Type                      | Notes                                           |
| ------------------------------ | ------------------------- | ----------------------------------------------- |
| `SUPABASE_PROD_SERVICE_ROLE`   | Supabase API              | Host = your Supabase URL, Service-role key      |
| `ANTHROPIC_PROD_API`           | HTTP Header Auth          | Header `x-api-key`, value = your Claude API key |
| `SLACK_PROD_INTERNAL_ALERTS`   | Slack OAuth2 (or webhook) | For escalation + health alerts                  |
| `GMAIL_PROD_TRANSACTIONAL`     | Gmail OAuth2              | Used by 08-escalation to email the user         |

### 3. n8n — set environment variables (Settings → Variables)

| Variable                     | Example                                           | Used in                      |
| ---------------------------- | ------------------------------------------------- | ---------------------------- |
| `GLOBAL_APP_URL_STG`         | `https://stg.usebylda.com`                        | router, dispatcher           |
| `GLOBAL_APP_URL_PROD`        | `https://usebylda.com`                            | escalation email             |
| `GLOBAL_AI_MODEL_DEFAULT`    | `claude-sonnet-4-6`                               | every Claude call            |
| `GLOBAL_ERROR_WEBHOOK_URL`   | `https://hook.n8n.cloud/.../err-router`           | every Error Trigger          |
| `GLOBAL_SLACK_ALERT_CHANNEL` | `#bylda-ops-alerts`                               | escalation, health           |
| `N8N_WEBHOOK_BASE_URL`       | `https://launchpad-novaops.app.n8n.cloud/webhook` | inter-workflow calls         |
| `BYLDA_OPS_ADMIN_TOKEN`      | (32+ char random secret)                          | guards prompt-swap           |
| `STRIPE_UPGRADE_URL`         | `https://billing.stripe.com/p/login/...`          | insufficient-credit response |

> Generate `BYLDA_OPS_ADMIN_TOKEN` once: `openssl rand -hex 32`

### 4. n8n — your platform must expose these endpoints

The workflows call these on `GLOBAL_APP_URL_STG`. Build them in your Platform repo (Vercel/Next.js):

- `POST /api/webhooks/credit-deduct` → `{ user_id, action, credits } → { allowed, remaining }`
- `POST /api/webhooks/subagents/<slug>` → one per intent (lead-gen, copywriting, …)

### 5. n8n — register webhooks (after import)

For each webhook workflow, after import: open it → **Save** → click on the
Webhook node → copy the **Production URL** → paste it into your platform's
config / environment.

### 6. Activate in this order

1. `10 prompt-swap` (so you can hot-swap before others go live)
2. `06 memory-read`, `05 memory-write`
3. `02 context-loader`
4. `03 tool-dispatcher`, `04 response-formatter`
5. `07 confidence-fallback`
6. `08 escalation`
7. `01 main-router` (front door — last)
8. `09 health-check` (cron — once everything else is up)

---

## 🔁 Hot-swap a Claude prompt without redeploy

```bash
curl -X POST https://launchpad-novaops.app.n8n.cloud/webhook/operator-prompt-swap \
  -H "Content-Type: application/json" \
  -d '{
    "admin_token":     "'"$BYLDA_OPS_ADMIN_TOKEN"'",
    "component":       "lead_gen",
    "new_system_prompt": "You are a senior B2B lead-gen strategist…",
    "version_label":   "v2-2026-04-29"
  }'
```

Every Claude workflow re-reads from `operator_prompts` on the next request.

---

## 🛠 If you change the Supabase project ref

```bash
# from repo root
grep -rl ipidfqwlszuhjgjygbvx n8n/workflows | \
  xargs sed -i 's/ipidfqwlszuhjgjygbvx/<your_new_ref>/g'
```

Re-import the affected workflows.

---

## Ownership boundary (decided 2026-06, platform redesign)

**Edge functions own product flows. n8n owns comms + billing-ops.**

Product-critical paths (onboarding completion, workspace provisioning,
mission seeding, AI dashboard generation, tool execution) are implemented
exclusively in Supabase edge functions (`complete-onboarding`,
`provision-workspace`, `generate-ai-dashboard`, `run-tool`). n8n must not
duplicate them.

### Deprecated / broken workflows in /N8N (do not deploy)

| Workflow                                                | Status         | Reason                                                                                                                                                                         |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bylda_ops_provision_workspace_setup.json`              | **deprecated** | Duplicates the `provision-workspace` edge function (now superseded by `complete-onboarding` + `provision_workspace_tx`). Two implementations drifted.                          |
| `bylda_ops_onboarding_intake_capture.json`              | **deprecated** | Legacy intake schema (`business_name`, `monthly_revenue_range`, `website_url`) that no longer matches the two-track onboarding; writes to a `users` table that does not exist. |
| `bylda_ops_onboarding_completion_operator_handoff.json` | **broken**     | References non-existent tables (`users`, `user_entitlements`, `user_credits`).                                                                                                 |
| `bylda_ops_dashboard_auto_creation.json`                | **broken**     | References `user_profiles` / `user_entitlements` / `user_credits` — none exist in the schema.                                                                                  |

Mission seed content has a single source of truth:
`supabase/functions/_shared/missionSeeds.ts`. If mission copy changes, change
it there — never in n8n workflow JSON.

n8n remains the right home for: welcome email sequences, Stripe lifecycle
comms (trial warnings, dunning), admin alert routing, and the daily health
check.
