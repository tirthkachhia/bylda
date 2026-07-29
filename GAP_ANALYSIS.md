# Bylda Launchpad — Gap Analysis & Roadmap

_What's missing to operate like HubSpot on the CRM side, and to create & scale users — plus
the two-view (Launchpad / BYLDA) restructure that ships alongside this document._

Last updated: 2026-06-15

---

## Context

Two questions drove this analysis:

1. **CRM:** what's missing for Bylda to operate like HubSpot?
2. **Create & scale users:** what delivery/infrastructure details are missing to onboard and
   grow many users?

The platform is far more mature than an MVP — full Stripe billing, multi-tenant orgs with RLS,
resumable two-track onboarding, 28 edge functions, 8 Cloudflare Workers, 78 tables. The gaps
are specific, not foundational. This doc inventories them, ordered by impact, and lays out a
phased roadmap that **interleaves CRM depth and scaling work** so neither axis stalls.

It also documents the **two-view restructure** (Launchpad vs BYLDA) built in this same change.

---

## What already works (do not rebuild)

- **CRM:** `leads` pipeline with Kanban/table/list/forecast (`src/routes/app.bylda.crm.tsx`),
  scoring, win-probability, weighted forecast, tags/priority, `crm_activities` timeline,
  `contact_notes`, n8n automations.
- **SaaS plumbing:** Supabase Auth, multi-tenant `organizations` + `organization_members`
  (RLS), full Stripe billing (4 tiers, checkout, portal, webhooks, usage metering), resumable
  2-track onboarding, settings + encrypted integrations.
- **Guidance system:** a 5th-grade hand-holding layer already exists
  (`src/lib/step-execution-guidance.ts`, `StepExecutionGuide`, `ToolGuidePanel`,
  `NextStepHero`, mission seeds).

---

## A. CRM gaps vs HubSpot (priority-ordered)

| #   | Gap                                 | Evidence / Notes                                                                                                                                                           | Priority      |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | **No Contacts object**              | `contacts` table is absent from all 43 migrations, yet `src/routes/app.contacts.tsx` and `workers/bylda-contacts-api/` query it. Contacts is **broken at the data layer**. | P0 (blocking) |
| 2   | **No Companies / Accounts object**  | No company records, no contact↔company link. HubSpot's core is Contacts + Companies + Deals + Tickets.                                                                     | P0            |
| 3   | **Objects not linked**              | No Deal↔Contact↔Company associations — the relationship graph HubSpot is built on.                                                                                         | P1            |
| 4   | **Email**                           | No 2-way sync, send-from-CRM, open/click tracking, or logging. `email` activity type is a stub.                                                                            | P1            |
| 5   | **Calls / meetings / tasks**        | Activity types defined; no real objects or integrations (no telephony, no calendar sync).                                                                                  | P2            |
| 6   | **Sequences / cadences**            | No object-aware multi-step outreach builder. n8n exists but isn't tied to CRM records.                                                                                     | P2            |
| 7   | **Lead-scoring engine**             | `score` is a stored number; no rules, decay, or automatic recompute.                                                                                                       | P2            |
| 8   | **Custom fields UI**                | `custom_fields` JSONB exists; no property manager / builder.                                                                                                               | P3            |
| 9   | **Lists & segmentation**            | Only ad-hoc filters; no saved smart lists.                                                                                                                                 | P3            |
| 10  | **Import / export / dedupe**        | No CSV import, no bulk loader, no export, no merge.                                                                                                                        | P2            |
| 11  | **Reporting builder**               | Only fixed ROI/weekly reports; no custom dashboards.                                                                                                                       | P3            |
| 12  | **Forms / landing pages / capture** | No top-of-funnel lead ingestion into the CRM.                                                                                                                              | P3            |

---

## B. Create & scale-users gaps (priority-ordered)

| #   | Gap                              | Evidence / Notes                                                                                                                  | Priority |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Team / seat management UI**    | Roles exist in `organization_members`; `auth.invite.tsx` is accept-only. No invite/member/role screen. Blocks real team accounts. | P1       |
| 2   | **Zero automated tests**         | No Vitest/Jest/Playwright. CI only type-checks + lints. **Highest risk for scaling.**                                             | P1       |
| 3   | **No error tracking / alerting** | No Sentry; logs scattered; no centralized alerts.                                                                                 | P1       |
| 4   | **In-memory rate limiting**      | `_shared/security.ts` limits per-isolate — breaks across regions. Needs KV/Upstash.                                               | P2       |
| 5   | **No caching layer**             | No Redis/Cloudflare KV for sessions, queries, or rate limits.                                                                     | P2       |
| 6   | **No in-app notifications**      | No notification center, no real-time alerts.                                                                                      | P2       |
| 7   | **No real-time**                 | No Supabase Realtime / websockets; updates are polling-based.                                                                     | P3       |
| 8   | **No full-text search**          | Only embedding search on `context_sources`; CRM lists unindexed.                                                                  | P3       |
| 9   | **Auth depth**                   | No SSO/OAuth, no MFA, minimal password policy.                                                                                    | P3       |
| 10  | **Billing depth**                | No seat-based/usage billing, no annual plans, no trial enforcement.                                                               | P3       |
| 11  | **Ops / docs**                   | No root README, no API spec, no deploy/DR runbook; no Storage bucket configured.                                                  | P2       |

---

## C. Two-view architecture (Launchpad / BYLDA) — shipped with this doc

**Problem:** one shell showed every feature to everyone — confusing for both new founders and
running operators.

**Solution:** the app now presents **two clear, switchable views**, backed by the existing
`workspaces.mode` column (`create` | `operate`):

- **Launchpad** (create & launch, orange) — Journey, Workbench, Customers, Library;
  primary nav = Build / Launch / Grow.
- **BYLDA** (operate & scale, cyan) — Customers/CRM, Automate, Insights, Library;
  primary nav = Automate / Optimize / Scale.

**How it works:**

- `src/hooks/use-workspace-mode.ts` — reads/writes `workspaces.mode` (RLS:
  `workspaces_update_owner`), optimistic cache update; guests persist to `sessionStorage`.
- `src/components/app/ViewSwitcher.tsx` — two-segment toggle in the sidebar header.
- `src/components/app/AppSidebar.tsx` — filters the Toolbox to each view's groups
  (`LAUNCHPAD_GROUP_IDS` / `BYLDA_GROUP_IDS`) and swaps the primary nav.

**BYLDA = explained for a total beginner.** BYLDA's operate mission (`buildOperatorBaseline`
in `supabase/functions/_shared/missionSeeds.ts`) was already seeded but its tools had **no
guidance entries**, so steps fell back to generic copy. We added 5th-grade guidance for the
operate/scale tools (`kpi-dashboard`, `seo-audit`, `launch-checklist`, `email-sequence`,
`ad-copy`) in `src/lib/step-execution-guidance.ts`, so BYLDA now gets the same
"what / why / 3 small steps / done-when" hand-holding Launchpad has — in `StepExecutionGuide`,
`NextStepHero`, `MissionChecklist`, and `ToolGuidePanel`.

---

## D. Phased roadmap (balanced CRM + scale)

### Phase 0 — Unblock (days)

- Create `contacts` + `companies` tables (migration + RLS), wire to existing
  `workers/bylda-contacts-api/`, fix the broken `app.contacts.tsx`. **[CRM A1, A2]**
- Two-view split + BYLDA 5th-grade guidance. **[C — done in this change]**

### Phase 1 — CRM core + safety net (weeks 1–4)

- Deal↔Contact↔Company associations. **[A3]**
- Team / seat management UI on existing `organization_members` backend. **[B1]**
- Sentry + centralized alerting. **[B3]**
- Vitest + critical-path tests; root README. **[B2, B11]**

### Phase 2 — Engagement + scale hardening (weeks 5–8)

- Email send/log + sequences; real task/meeting/call logging. **[A4, A5, A6]**
- Lead-scoring engine. **[A7]**
- CSV import/export + dedupe. **[A10]**
- Distributed rate limiting (KV/Upstash) + caching; in-app notifications. **[B4, B5, B6]**

### Phase 3 — Power features (weeks 9–12)

- Reporting/dashboard builder, custom-fields/property UI, lists & segmentation. **[A8, A9, A11]**
- Full-text search; Supabase Realtime. **[B7, B8]**

### Phase 4 — Funnel + enterprise (weeks 13–16)

- Forms / landing pages / capture. **[A12]**
- SSO/MFA; seat/annual billing; load testing + DR runbook. **[B9, B10]**

---

## E. Shipped in this change set

Built, type-checked, unit-tested, and (for migrations) applied to the live DB and validated
with the security advisor:

- **Two-view split (Launchpad / BYLDA) + BYLDA 5th-grade guidance.** [C]
- **CRM data model** — `companies` table (new) + `contacts` codified into a migration. Note:
  `contacts` already existed in **production via schema drift** (never in a migration), so a
  fresh DB lacked it; `supabase/migrations/20260615000001_crm_contacts_companies.sql` now
  matches the live shape and adds `company_id`, the missing `contact_notes.contact_id` FK, an
  `updated_at` trigger, and `leads.contact_id` / `leads.company_id` associations. [A1, A2, A3]
- **Team management** — `list_org_members` SECURITY DEFINER RPC (members can see teammates
  without loosening `profiles` RLS), `team-invite` edge function (owner/admin-gated, handles
  existing accounts + new invites), and a **Team** tab in `app.settings.tsx` (invite, change
  role, remove). [B1]
- **Tests + docs** — Vitest harness + 26 unit tests, a CI `test` step, and a root README. [B2, B11]
- **Error tracking** — Sentry scaffold gated behind `VITE_SENTRY_DSN` (`src/lib/observability.ts`)
  - a root `ErrorBoundary`; no-op without a DSN. [B3]
- **Lead scoring** — `src/lib/lead-scoring.ts` (pure, tested) + "Recompute scores" in Contacts. [A7]
- **CSV import/export** for Contacts (papaparse), scoring rows on import. [A10]
- **Full-text search** — trigger-maintained `tsvector` + GIN indexes + `search_leads` /
  `search_contacts` RPCs (`20260615000002_crm_search.sql`). [B8]
- **Distributed rate-limiting seam** — pluggable async backend + KV/Upstash adapter in
  `supabase/functions/_shared/security.ts` (in-memory default unchanged). [B4, code side]

## F. Deferred — needs external infra/credentials

Not built here because they require accounts, secrets, or infra that can't be provisioned or
verified from the repo. Each is a clean follow-up:

- **Email 2-way sync / send-from-CRM / open-click tracking** — needs an email provider + OAuth. [A4]
- **Telephony (calls) and calendar (meetings)** — needs Twilio / Google Calendar credentials. [A5]
- **Sequences / cadences engine** — needs a scheduler + the email integration above. [A6]
- **Distributed rate-limit + cache provisioning** — adapter shipped; needs a Cloudflare KV
  namespace / Upstash instance + wrangler binding, then `setRateLimitBackend(...)` at boot. [B4, B5]
- **In-app notifications + Supabase Realtime** — table + bell + subscriptions (UI surface). [B6, B7]
- **Reporting/dashboard builder, custom-fields UI, lists & segmentation** — large UI surfaces. [A8, A9, A11]
- **Forms / landing pages** — public capture endpoints + builder. [A12]
- **SSO/MFA, Stripe seat/annual billing, load testing, DR runbook** — auth provider / Stripe
  config / infra. [B9, B10]

## Verification

- `bun run tsc --noEmit`, `bun run test`, `bun run lint`, `bun run build` — all green (CI gates).
- Migrations applied to the live project and confirmed: `companies` exists, `contacts.company_id`
  - `updated_at` trigger present, `contact_notes` FK created, `leads` associations + search
    vectors in place; security advisor shows no new issues.
- Manual smoke (post-deploy): ViewSwitcher flips Launchpad↔BYLDA and persists; Contacts page
  loads, CSV import/export + recompute work; Team tab lists members and invites send.
