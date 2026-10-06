# BACKEND_BOUNDARY.md — read-only backend surface

**Single source of truth.** `.github/workflows/backend-guard.yml` and
`scripts/boundary-check.sh` both parse the fenced `boundary-patterns` block below.
Edit the patterns in one place only: here.

During the Bylda V1 frontend rebuild every path matched below is **read-only** —
except on the backend track: a PR from a `backend/*` branch **with the label
`backend`** may change them (`scripts/backend-pr-gate.sh`, `CLAUDE.md` §12 D/G).
Read it to learn the contract. Never add, modify or delete an endpoint, field,
table, column, type, policy or migration. Ambiguous → ask, don't guess.

---

## Why these paths

This repo has **no `"use server"` files and no `createServerFn` / API file routes.**
Verified: `grep -rl "use server" src/` and
`grep -rl "createServerFn\|createServerRoute\|createAPIFileRoute" src/` both return nothing.

The backend is therefore three things, none of them inside the React tree:

1. **Supabase** — 106 SQL migrations, 61 edge functions, RLS policies, generated types.
2. **Cloudflare Workers** — 8 standalone HTTP APIs under `workers/`.
3. **n8n** — automation workflow + subagent JSON definitions.

The frontend reaches all of it over the wire: `supabase.from(...)` /
`supabase.rpc(...)` against RLS-protected tables, and `invokeEdge(...)` /
`supabase.functions.invoke(...)` against edge functions. That wire is the contract.

---

## Guarded patterns

<!-- BOUNDARY-PATTERNS:START -->
```boundary-patterns
# ── Supabase: schema, policies, edge functions, project config ──────────────
supabase/**

# ── Cloudflare Workers: standalone HTTP APIs + their config ────────────────
workers/**
wrangler.jsonc

# ── n8n automation + subagent definitions ─────────────────────────────────
n8n/**
N8N/**

# ── Generated DB types (regenerated from the live schema, never hand-edited) ─
src/integrations/supabase/types.ts

# ── Server-only Supabase clients and session middleware ───────────────────
src/integrations/supabase/client.server.ts
src/integrations/supabase/auth-middleware.ts

# ── Environment and secrets — never create, fake, edit or commit ──────────
.env
.env.*
**/.env
**/.env.*
.dev.vars

# ── Seed / teardown SQL against the live schema ───────────────────────────
scripts/demo-seed/**

# ── Shared cross-boundary contract schema ─────────────────────────────────
spec_schema.ts
```
<!-- BOUNDARY-PATTERNS:END -->

Patterns are git-pathspec globs relative to the repo root. `**` matches across
directories. Lines starting `#` and blank lines are comments.

---

## What each guarded path is

| Path | What it is | Contract the frontend reads from it |
| --- | --- | --- |
| `supabase/migrations/**` (106 files) | Postgres DDL, RLS policies, triggers, cron | Table + column names, check constraints, enum values, RLS scoping (`is_org_member(organization_id, auth.uid())`) |
| `supabase/functions/**` (61 functions + `_shared/`) | Deno edge functions | Request/response JSON shapes |
| `supabase/functions/_shared/**` | Shared edge helpers (`context-engine`, `crm-adapters`, `sales-verticals`, `security`, `stripe`, …) | Payload shapes reused across functions |
| `supabase/config.toml` | Per-function `verify_jwt` gateway auth | Which functions need a user session vs. anon |
| `workers/bylda-context-api/` | Context package API | — |
| `workers/bylda-contacts-api/` | Contacts API | — |
| `workers/bylda-automations-api/` | Automations API | — |
| `workers/bylda-tools-api/` | Tool run API | — |
| `workers/bylda-ai-api/` | AI gateway API | — |
| `workers/bylda-stripe-api/` | Stripe API | — |
| `workers/bylda-automation-consumer/` | Queue consumer | — |
| `workers/bylda-pulse/` | Scheduled pulse | — |
| `wrangler.jsonc` | Worker bindings, queues, public vars, secret manifest | — |
| `n8n/**`, `N8N/**` | `n8n/`: 15 workflows, 7 subagents, 10 launchpad tools (JSON), deploy script, `n8n/supabase/001_operator_schema.sql`. `N8N/`: 46 `bylda_ops_*` / `stripe-*` workflows + `N8N/migrations/*.sql` | — |
| `src/integrations/supabase/types.ts` | Generated `Database` type — 105 tables, 9 views, 23 functions | The typed surface screens consume via `/lib/data` |
| `src/integrations/supabase/client.server.ts` | Service-role client (bypasses RLS) | Never imported from a screen |
| `src/integrations/supabase/auth-middleware.ts` | `requireSupabaseAuth` bearer-token middleware | — |
| `.env*`, `.dev.vars` | `.env.example`, `.env.development`, `.env.production` are committed; `.env`/`.env.local` are gitignored. `.dev.vars` does not exist today — guarded pre-emptively (Wrangler local secrets) | Variable **names** only |
| `scripts/demo-seed/**` | `seed-demo-account.sql`, `teardown-demo-account.sql` | — |
| `spec_schema.ts` | `ByldaSpec` agent-executable spec type | — |

⚠️ **`src/integrations/supabase/types.ts` is stale.** It does not contain
`calls`, `call_insights` or `call_transcripts`, even though migration
`20260719000006_crm_phase4_calling.sql` creates all three and the frontend queries
them — and 13 more queried tables are missing the same way (list in `AUDIT.md`). `src/routes/app.crm.calls.tsx` works around this with
`const db = supabase as any` plus a file-level
`eslint-disable @typescript-eslint/no-explicit-any`.
Regenerating the types **is a backend change** — it is out of scope for this rebuild.
Until an owner regenerates them, model the missing tables as hand-written types in
`src/lib/data/types/` and tag each one `// GAP: types.ts stale`.

---

## Not guarded — frontend, yours to rebuild

- `src/routes/**` — TanStack Router file routes (87 files)
- `src/components/**` — all React components
- `src/components/lanes/**` — per-lane V1 screens (`CLAUDE.md` §8)
- `src/lib/data/**` — new frontend data layer (the only thing screens import)
- `src/styles.css`, `src/styles/**`, `src/lib/theme*.ts`
- `src/hooks/**`, `src/constants/**`, `src/router.tsx`, `src/routeTree.gen.ts`
- `src/lib/**` except the files listed under UNSURE below
- `public/**`, `prototypes/**`, `docs/**`, `*.md`

---

## UNSURE — ruled 2026-09-30

**Ruling (`CLAUDE.md` §12 A):** every file below is **frozen** — not boundary-guarded,
but read-only for lanes, owner Ansh; lanes reach them only through `src/lib/data`.
`src/lib/observability.ts` and `analytics.ts` are callable, not editable. The table
is kept for the reasoning.

These are **client-side** files (they run in the browser, import
`@/integrations/supabase/client`, and are not backend code by any mechanical test),
but each one **encodes a backend contract**. Guarding them blocks the rebuild;
leaving them open risks silent contract drift. Not guessing — listing.

| Path | Lines | What it does | The call |
| --- | --- | --- | --- |
| `src/lib/invokeEdge.ts` | ~200 | The single client gateway to edge functions: auth header, timeout, retry, `EdgeError` typing, SSE variant | **Recommend: not guarded, treat as frozen.** Lane 2 wraps it; nobody edits it. It is good code and the retry/timeout semantics are load-bearing. |
| `src/lib/queries.ts` | — | Client wrappers over edge functions + tables | **Recommend: not guarded.** `/lib/data` supersedes it; read it for contracts, then leave it until the old routes are deleted. |
| `src/lib/crm.ts` | — | CRM read/write helpers | Same as `queries.ts`. |
| `src/lib/auth.tsx` | — | `useAuth`, session/profile/role context | **Recommend: not guarded but shared-foundation.** Rebuilding auth risks session breakage; changes go through `LANE_REQUESTS.md`. |
| `src/integrations/supabase/client.ts` | — | Browser Supabase client (anon key) | **Recommend: not guarded, treat as frozen.** No reason to touch it. |
| `src/lib/feature-gates.ts`, `plan.ts`, `stripe.ts` | — | Plan/entitlement gating mirroring `plan_tier_limits` + `feature_entitlements` | Plan gating in V1 is undecided. **Blocks nothing yet; decide before Lane 5 (Settings/Billing).** |
| `src/lib/impersonation.ts`, `admin.ts`, `ownerMode.ts` | — | Admin/impersonation paths hitting `admin_audit_log` | Admin V1 scope undecided. **Decide before Lane 1 (Admin Home).** |
| `src/lib/observability.ts`, `analytics.ts` | — | Event emission into `platform_events` / `usage_events` | Whether V1 screens emit analytics is undecided. |
| `.lovable/` | — | Lovable platform metadata; unclear whether generated or committed intentionally | Leave alone either way. |
| `bunfig.toml`, `vite.config.ts` | — | Package manager + build config. Not backend, but `vite.config.ts` sets the Nitro/Vercel preset | **Recommend: foundation-owned (Ansh), not lane-editable.** |

**Default while undecided: treat every UNSURE path as read-only.** Read it,
copy the contract into `/lib/data`, and log the request in `LANE_REQUESTS.md`.
