# Bylda Launchpad · Tool Workflows

Ten Claude-powered n8n workflows that back the LaunchPad tool surface. Each
workflow is self-contained, entitlement-gated against `user_entitlements`,
and writes its result to Supabase before responding.

| #   | Workflow              | Webhook path (`v1/...`)    | Tool key (`user_entitlements.tool`) |
| --- | --------------------- | -------------------------- | ----------------------------------- |
| 01  | Ad Creative Generator | `v1/ad-creative/generate`  | `tool_ad_creative`                  |
| 02  | Cold Email Sequencer  | `v1/cold-email/sequence`   | `tool_cold_email`                   |
| 03  | ICP Builder           | `v1/icp/build`             | `tool_icp`                          |
| 04  | Landing Page Copy     | `v1/landing-copy/generate` | `tool_landing_copy`                 |
| 05  | Lead Magnet Builder   | `v1/lead-magnet/generate`  | `tool_lead_magnet`                  |
| 06  | Niche Validator       | `v1/niche/validate`        | `tool_niche_validator`              |
| 07  | Offer Builder         | `v1/offer/build`           | `tool_offer`                        |
| 08  | Pitch Deck Outliner   | `v1/pitch-deck/outline`    | `tool_pitch_deck`                   |
| 09  | Pricing Strategist    | `v1/pricing/strategy`      | `tool_pricing`                      |
| 10  | VSL Generator         | `v1/vsl/generate`          | `tool_vsl`                          |

Source files were imported as-is from product. They use the
`SUPABASE_URL` / `SUPABASE_KEY` / `ANTHROPIC_API_KEY` environment-variable
convention (not the `SUPABASE_PROD_SERVICE_ROLE` credential alias used by
the operator workflows in `../workflows/`).

---

## 1 · n8n environment variables

Set these in your n8n instance:

```bash
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_KEY=<service-role-key>            # used as Bearer + apikey
ANTHROPIC_API_KEY=<your-anthropic-key>
```

The workflows reference them as `{{ $env.SUPABASE_URL }}`, etc.

---

## 2 · Supabase tables expected

Each workflow gates on `user_entitlements (user_id, tool, enabled)` and
writes the run output to a tool-specific table (`ad_creatives`, `cold_email_sequences`,
`ideal_customer_profiles`, `landing_page_copies`, `lead_magnets`,
`niche_validations`, `offers`, `pitch_decks`, `pricing_strategies`,
`vsl_scripts`). If those tables don't exist yet, create them or adapt the
final HTTP node to point at your real schema.

---

## 3 · Import order

```
01-launchpad-ad-creative-generator.json
02-launchpad-cold-email-sequencer.json
03-launchpad-icp-builder.json
04-launchpad-landing-page-copy.json
05-launchpad-lead-magnet-builder.json
06-launchpad-niche-validator.json
07-launchpad-offer-builder.json
08-launchpad-pitch-deck-outliner.json
09-launchpad-pricing-strategist.json
10-launchpad-vsl-generator.json
```

After import, open each → bind any red-flagged credentials (Supabase, Anthropic) →
**Activate**.

---

## 4 · Frontend wiring

Typed wrappers live in `src/lib/launchpadTools.ts` and follow the
`SubagentResult<T>` envelope used by `src/lib/subagents.ts`. Each call
POSTs to `${VITE_N8N_BASE_URL}/webhook/v1/<path>` (defaults to
`/api/n8n/webhook/v1/...` in production via the Cloudflare proxy).

```ts
import { callAdCreative, callNicheValidator } from "@/lib/launchpadTools";

const result = await callNicheValidator(
  { user_id: session.user.id, niche: "med spas", region: "NA" },
  session.access_token,
);
```

---

## 5 · Smoke test

```bash
curl -X POST https://n8n.usebylda.com/webhook/v1/niche/validate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","niche":"med spas","region":"NA"}'
```

A 200 with the relevant payload means entitlement → Claude → Supabase
all fired. A response containing `"upgrade_url"` means the user is not
entitled — wire your frontend to surface the upsell.
