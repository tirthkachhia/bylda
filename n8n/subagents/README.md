# Bylda Launchpad · Subagents

Six Claude-powered n8n subagents that power the Launchpad tool surface.
All workflows are **self-contained**, plan-gate aware, and deduct credits
after a successful run.

| #   | Workflow           | Webhook path                  | Plan gate | Credit cost | Tables touched                                  |
| --- | ------------------ | ----------------------------- | --------- | ----------- | ----------------------------------------------- |
| 1   | Brand Voice        | `brand-voice-subagent`        | All paid  | 15          | `users`, `operator_prompts`, `user_ai_config`   |
| 2   | Blog Content       | `content-subagent-blog`       | All paid  | 10          | `users`, `user_ai_config`, `content_outputs`    |
| 3   | Social             | `social-subagent`             | All paid  | 5 / post    | `users`, `user_ai_config`, `content_outputs`    |
| 4   | Sales Script       | `sales-script-subagent`       | All paid  | 8           | `users`, `user_ai_config`, `content_outputs`    |
| 5   | Client Reporting   | `client-reporting-subagent`   | All paid  | 20          | `users`, `client_kpi_metrics`, `client_reports` |
| 6   | Automation Builder | `automation-builder-subagent` | **$149+** | 25          | `users`, `automation_drafts`                    |

> The `users` view (added in `supabase/migrations/20260429220000_subagent_schema.sql`)
> projects `profiles + subscriptions + plan_entitlements` into `(user_id, plan_tier, email)`
> with `plan_tier` as a numeric price string. The Automation Builder gate compares
> against `['149','299']` — Operate and Scale tiers.

---

## 1 · One-time Supabase setup

The two migrations in `supabase/migrations/` are picked up automatically by
the Supabase Lovable integration on the next push.

To apply manually instead:

```bash
# from repo root
supabase db push
```

**What gets created**

- `public.users` view (subagent-friendly)
- `user_ai_config`, `content_outputs`, `automation_drafts`
- `client_reports`, `client_kpi_metrics`, `credit_ledger`
- `user_credit_balance` view
- 6 system prompts seeded into `operator_prompts`
- RLS policies (service_role full access, authenticated own-rows)

---

## 2 · n8n credentials to create

In n8n → **Credentials**, create exactly these (names must match the JSON):

| Credential name     | Type        | Notes                                                                                                                        |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Supabase Postgres` | Postgres    | Host: `db.ipidfqwlszuhjgjygbvx.supabase.co`, port 5432, db `postgres`, user `postgres`, password = Supabase service role pwd |
| `Anthropic API Key` | Header Auth | Header name: `x-api-key` · Value: your `ANTHROPIC_API_KEY`                                                                   |

After importing the JSONs, n8n will flag missing credential refs — bind each
node to the credentials above. Placeholder IDs in the JSON
(`SUPABASE_POSTGRES_CRED_ID`, `ANTHROPIC_HEADER_AUTH_CRED_ID`) get replaced
on import.

---

## 3 · n8n environment variables

Set these in your n8n instance (Cloudflare Tunnel → n8n container env, or
`.env` if self-hosted):

```bash
# Where the Deduct Credits step POSTs to. Point at your own n8n credit-ledger workflow.
CREDIT_DEDUCTION_WEBHOOK_URL=https://<your-n8n-host>/webhook/credit-ledger-deduct
```

A minimal credit-ledger workflow is included as `_credit-ledger-deduct.json` —
import that first.

---

## 4 · Import order

Import the workflows into n8n in this order:

1. `_credit-ledger-deduct.json` (creates `/webhook/credit-ledger-deduct`)
2. `01-brand-voice-subagent.json`
3. `02-content-subagent-blog.json`
4. `03-social-subagent.json`
5. `04-sales-script-subagent.json`
6. `05-client-reporting-subagent.json`
7. `06-automation-builder-subagent.json`

For each, after import:

1. Open the workflow → click each red-flagged node → bind credential.
2. **Activate** the workflow (toggle top-right).
3. Copy the production webhook URL from the Webhook node.

---

## 5 · Cloudflare front door

The frontend hits `${VITE_N8N_BASE_URL}/webhook/<path>`. Two routing options:

### Option A — direct (simplest)

Set `VITE_N8N_BASE_URL=https://n8n.usebylda.com` in Vercel, expose your
n8n instance under that subdomain via a Cloudflare Tunnel.

```bash
# Cloudflare Tunnel, on the box running n8n
cloudflared tunnel route dns bylda-n8n n8n.usebylda.com
cloudflared tunnel run bylda-n8n   # forwards to localhost:5678
```

### Option B — proxy through your app (recommended for prod)

Add a Cloudflare Worker that forwards `/api/n8n/*` → n8n, attaching a shared
secret and stripping the user's Supabase JWT into a verified header. This
keeps your n8n host hidden and lets you rate-limit per-user.

`VITE_N8N_BASE_URL=/api/n8n` (default).

A starter Worker template ships at `cloudflare/n8n-proxy/` (not yet built —
add when ready).

---

## 6 · Frontend usage

```ts
import { callBrandVoice, isPlanGateBlock, getUpgradeUrl } from "@/lib/subagents";
import { supabase } from "@/integrations/supabase/client";

const {
  data: { session },
} = await supabase.auth.getSession();
const result = await callBrandVoice(
  { user_id: session!.user.id, raw_intake: "..." },
  session?.access_token,
);

if (!result.success) {
  if (isPlanGateBlock(result)) navigate(getUpgradeUrl(result));
  else toast.error(result.error);
  return;
}

console.log(result.data.brand_voice);
```

All 6 callers live in `src/lib/subagents.ts` and share the same shape.

---

## 7 · Smoke tests (curl)

After each workflow is active, test directly:

```bash
# Brand voice — should return brand_voice JSON
curl -X POST https://n8n.usebylda.com/webhook/brand-voice-subagent \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<real-uuid>","raw_intake":"We help med spas book more consults via AI follow-ups. Tone is confident, expert, no fluff."}'

# Automation builder — expect 403 if user is on starter plan
curl -X POST https://n8n.usebylda.com/webhook/automation-builder-subagent \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<real-uuid>","process_description":"When a Typeform submission comes in, post to Slack and create a HubSpot deal","integrations":["typeform","slack","hubspot"]}'
```

A 403 with `code:"PLAN_UPGRADE_REQUIRED"` means the gate works.
A 200 with `workflow_json` means Claude → Supabase → credit deduction all fire.

---

## 8 · Rolling out new prompts

Prompts live in `operator_prompts.system_prompt`. To swap:

```sql
update public.operator_prompts
   set system_prompt = $$...new prompt...$$,
       version       = 'v2',
       updated_at    = now()
 where component = 'social_subagent';
```

No redeploy needed — the workflow re-fetches on every request.

---

## 9 · Optimization notes

- **Caching:** brand_voice rarely changes. Add a `Set` node before Claude
  to short-circuit when `user_ai_config.brand_voice` already exists for the
  user and `force_refresh` is not in the body.
- **Cost control:** all subagents use `claude-sonnet-4-5` at `max_tokens: 4000`.
  Drop to `claude-haiku-4-5` for social/sales_script if quality holds — saves
  ~70% per call.
- **Concurrency:** each subagent is stateless apart from the final insert —
  safe to scale horizontally.
- **Credit ledger view:** `user_credit_balance` exposes remaining credits per
  user, so the frontend can show a meter without a custom endpoint.
