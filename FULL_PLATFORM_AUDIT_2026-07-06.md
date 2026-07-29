# Full Platform Audit — Frontend & Backend

**Date:** 2026-07-06
**Branch:** `claude/platform-audit-frontend-backend-r40jff`
**Scope:** Everything — build health, frontend (routes/components/hooks), backend
(Supabase edge functions, Cloudflare workers, migrations), security, and the
open items carried over from prior audits (PLATFORM_AUDIT_REPORT.md,
PHASE10_AUDIT.md, SESSION_STATUS.md, AUDIT_FIXES_SUMMARY.md).

---

## Verdict in one paragraph

The platform **builds, type-checks, lints, and tests green**, and the live
deployment responds (app + edge functions return 200). Nothing is "down."
What _is_ failing is one **critical security leak (live service-role key
committed to git)**, a handful of **routing bugs that undermine the new
two-product split** (signed-in users still land on the legacy dashboard),
and a tail of **carry-over debt** that previous sessions flagged and never
closed: ~1,000 lines of duplicated mission definitions, dead legacy routes,
a stale npm lockfile that breaks `npm ci`, and 226 design-token lint warnings.

---

## 1. Health checks (all run fresh in this session)

| Check                                     | Result                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| `tsc --noEmit`                            | ✅ clean                                                |
| `vitest run`                              | ✅ 57/57 tests pass (7 files)                           |
| `eslint .`                                | ⚠️ 0 errors, **226 warnings** (see §4.4)                |
| `vite build` (production)                 | ✅ builds in ~20s                                       |
| Live app `app.usebylda.com`               | ✅ HTTP 200                                             |
| Live edge fn `track-event` (public pixel) | ✅ HTTP 200                                             |
| `npm ci`                                  | ❌ **fails** — package-lock.json out of sync (see §2.2) |

---

## 2. CRITICAL — fix these first

### 2.1 Live Supabase **service-role key is committed to git** 🔴

`.env.production` and `.env.development` are both tracked in the repository
and both contain the real `SUPABASE_SERVICE_ROLE_KEY` for project
`ipidfqwlszuhjgjygbvx` (plus the live Stripe publishable key, which is fine
to expose, and the anon key, also fine). The service-role key **bypasses all
RLS** — anyone with read access to this repo (or any fork/clone/CI log) has
full read/write on the production database. All the RLS work verified in
PHASE10_AUDIT.md is moot while this key is public.

`.gitignore` only excludes `.env` and `.env.local` — the `.development` /
`.production` variants slipped through.

**Fix (in order):**

1. Rotate the service-role key in Supabase Dashboard → Settings → API
   (this invalidates the leaked one).
2. Update the rotated key everywhere it's actually needed (Supabase edge
   function secrets, Cloudflare worker secrets via `wrangler secret put`,
   local `.env` files).
3. `git rm --cached .env.production .env.development`, add both (and
   `.env.*` generally, except `.env.example`) to `.gitignore`.
4. The key remains in git history — treat rotation as the real remediation.

### 2.2 `npm ci` is broken — lockfile drift, three lockfiles in the repo 🔴

The repo carries **`bun.lock`, `bun.lockb`, and `package-lock.json`**.
`package-lock.json` is out of sync with `package.json`
(`Missing: @sentry/react@10.63.0 from lock file`), so `npm ci` — the thing
CI systems and fresh environments run — fails outright. This session also hit
repeated `ConnectionClosed` tarball failures with bun, so the npm path being
broken means there is no reliable clean-install path.

**Fix:** pick one package manager (bun, per `bunfig.toml`), delete
`package-lock.json` and the obsolete binary `bun.lockb` (bun ≥1.2 uses the
text `bun.lock`), and add a CI step that runs a frozen-lockfile install.

---

## 3. HIGH — routing bugs that defeat the ecosystem split

PR #81 split the shell into two products (Launchpad = build, Bylda = run) with
mode-aware landing via `/app` → `resolveLandingPath()` (`app.index.tsx` does
this correctly). But three entry points still hardcode **pre-split targets**:

| Entry point                                                  | Where it sends users                | Should be                                  |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------ |
| `src/routes/index.tsx:12` — site root when already signed in | `/app/dashboard` (legacy dashboard) | `/app` (mode-aware resolver)               |
| `src/routes/auth.sign-in.tsx:25` — after sign-in             | hardcoded `/app/mission-control`    | `/app` — wrong home for operate-mode users |
| `src/routes/auth.invite.tsx:102` — after accepting invite    | `/app/dashboard`                    | `/app`                                     |
| `src/routes/app.billing.return.tsx:48` — back from Stripe    | `/app/dashboard`                    | `/app`                                     |

Net effect: a returning signed-in user visiting the site root lands on the
**old** dashboard, not on either product home. The most common entry path in
the product bypasses the entire new IA. One-line fixes each.

---

## 4. MEDIUM — frontend

### 4.1 Route sprawl: several generations of UI coexist (~41k lines of routes)

83 route files, 40,659 lines. Layered generations are all still present:

- **Dead full pages (no inbound links anywhere):** `app.blog.index.tsx` +
  `app.blog.$id.tsx` (796 lines), `app.approvals.tsx` (282 lines — the
  Automations nav _matcher_ highlights for it but nothing links to it).
- **Legacy redirect stubs (intentional, fine):** `app.command-center`,
  `app.bylda-os`, `app.bylda-os.$slug`, `app.bylda-full`, `app.launch-control`
  — but note `app.command-center` redirects to `/app/dashboard`, i.e. a
  legacy route redirecting to another legacy route.
- **Legacy-but-still-linked:** `app.dashboard.tsx` (1,338 lines, 6 inbound
  links — see §3), `app.galaxy.tsx` (443 lines, 1 link).
- **Near-duplicate CRM surfaces:** `app.bylda.crm.tsx` (3,215 lines — the
  largest file in the app), plus `app.leads.tsx`, `app.contacts.tsx`
  (1,657), `app.crm.companies.tsx`, `app.scale.pipeline.tsx` all render
  overlapping lead/contact/pipeline views.

**Improvement:** delete the dead pages, retarget the legacy links per §3,
then schedule the `app.dashboard` retirement. Consider splitting
`app.bylda.crm.tsx` — 3,215 lines in one route file is where regressions hide.

### 4.2 Monolithic route files

Top offenders: `app.bylda.crm.tsx` 3,215 · `app.launchpad.$tool.tsx` 2,397 ·
`app.builder.tsx` 1,818 · `app.contacts.tsx` 1,657 · `app.admin.tsx` 1,593.
None have file-level tests; the 57 passing tests cover only 7 lib modules
(booking, casefile, lead-scoring, automation-tree, guidance, catalog,
lane-classifier). UI/route logic has **zero test coverage**.

### 4.3 Client bundle

Initial client chunk is ~700 KB plus a 372 KB recharts chunk
(`BarChart-*.js`) that ships wherever charts render. Recharts 2.15 is
pinned (not ^), gsap + embla + dnd-kit + recharts together make the app
JS-heavy for a guided SMB tool. Not failing, but worth a lazy-load pass on
charts (already split, but confirm it's not pulled into the home route) and
a `rollup-plugin-visualizer` audit.

### 4.4 226 lint warnings — 92% are design-token violations

~208 warnings are `Use a design token instead of raw hex in inline styles`
— the rule added during the 3-color-theme work is being ignored in newer
components, which silently breaks the user-selectable palette
(hardcoded hex won't follow theme changes). 9 are `react-refresh`
mixed-export warnings, ~6 are real `react-hooks/exhaustive-deps` smells in
memoized query-derived values (`subs`/`runs` in two files) that can cause
unnecessary re-renders.

**Improvement:** burn down the hex-color warnings (mechanical), fix the two
`useMemo` dependency smells, then flip the token rule from `warn` to `error`
so it can't regress.

### 4.5 Positive findings (keep doing this)

- `invokeEdge.ts` is a genuinely good single gateway: timeouts, typed
  errors, retry-on-5xx-only, stream-safe. But **9 files still bypass it**
  with raw `supabase.functions.invoke` (14 call sites: `app.automations`,
  `app.billing` ×2, `app.memory`, `app.research`, `app.settings`,
  `lib/operator.ts` ×3, `lib/queries.ts` ×2, `lib/stripe.ts`,
  `lib/automation-run.ts` ×2) — those get no timeout, no retry, no typed
  errors. Migrate them.
- Router has a `defaultErrorComponent` + Sentry wired in `router.tsx` /
  `observability.ts`. Good.
- `use-business-graph.ts` cleanly aggregates signals; note it fetches up to
  500 tool runs on every shell render (sidebar uses it) — fine at current
  scale, but add `staleTime` awareness if dashboards feel chatty.

---

## 5. MEDIUM — backend

### 5.1 Carry-over debt explicitly left open by prior sessions (still open)

From AUDIT_FIXES_SUMMARY.md / SESSION_STATUS.md, verified still true today:

1. **Duplicate mission definitions (~1,000+ lines)** — mission/step content
   still lives in three places: `supabase/functions/_shared/missionSeeds.ts`
   (306 lines), the `NEXT_MISSIONS` block inside
   `supabase/functions/advance-mission/index.ts`, and the frontend guidance
   in `src/lib/step-execution-guidance.ts`. A tool-key rename must be made
   in three files or the UI and backend drift (this exact class of bug —
   tool-key mismatch 404s — was the critical bug of the June audit).
2. **Deeper Ask Bylda goal-oriented redesign** (BYLDA_OS_REDESIGN Part 6
   Screen 3) — still not built; `/app/mentor` remains the stand-in.
3. **Outcome completion tracking** — `isOutcomeDone` derives from tool_runs
   only; no persisted outcome state.
4. **PHASE10 "Wired" checklist** — the 8 interactive verifications (drag
   deal across pipeline, inbox Bylda Draft, public `/book/[slug]` submit,
   builder activate/test, campaign Send Now, casefile from real run, mobile
   drawers) have still never been ticked. These need one logged-in QA pass.
5. **Operator toggles** — live email/SMS still requires setting
   `RESEND_API_KEY`/`EMAIL_FROM`, Twilio keys, `INBOUND_WEBHOOK_SECRET`,
   and enabling `pg_cron` (scheduled campaigns + reminders are dormant
   until then). No code needed — dashboard toggles.

### 5.2 Wildcard CORS on all Supabase edge functions

`_shared/helpers.ts`, `_shared/security.ts`, `_shared/stripe.ts` all set
`Access-Control-Allow-Origin: *`, inherited by ~28 functions. Auth still
gates every sensitive function (JWT required), so this is not an open door,
but it removes the browser-origin layer of defense and lets any website
script your endpoints with a stolen token. The Cloudflare workers already do
this right (locked to `https://app.usebylda.com`).

**Improvement:** move edge functions to the same origin-check helper the
workers use.

### 5.3 Env-var handling in edge functions

`Deno.env.get("SUPABASE_URL")!` style non-null assertions throughout
`helpers.ts` and functions — a missing secret surfaces as an opaque runtime
crash instead of a clear 503. `receive-message` does this right
(returns 503 "not configured" when `INBOUND_WEBHOOK_SECRET` is unset);
adopt that pattern in the shared helper (was Issue #3 in the June audit,
still open).

### 5.4 Positive findings

- `runTool` pipeline is solid: JWT auth → org resolution → plan gate →
  **atomic quota with advisory lock + refund on failure** → context
  assembly → run persistence → memory indexing → verdict capture, with
  non-fatal paths clearly marked. The June audit's critical items
  (tool-key aliases, silent queue failures) are genuinely fixed —
  `bylda-automations-api` now marks logs `failed` and returns 500 on
  queue errors.
- All 7 Cloudflare workers validate JWTs against Supabase auth and lock
  CORS to the production origin.
- `payments-webhook` verifies Stripe signatures (`verifyWebhook`).
- `workflow-engine` has a step budget (`MAX_STEPS = 50`) with trace output
  — no infinite-loop risk from cyclic automations.
- Migrations show good hygiene: RLS on all new tables, EXECUTE revoked on
  trigger functions, `search_path` pinned (all re-confirmed in PHASE10).
- All 15 n8n workflows carry error-handler config.

---

## 6. LOW / polish

- **Doc rot:** six audit/status markdown files at repo root reference
  dead branches (`claude/jolly-hamilton-mvepgp`) and superseded designs
  (logbook theme, shipped-then-removed). Move to `docs/archive/` so the
  root reflects reality.
- **`app.tutorials.tsx` / `app.templates.tsx`** use untyped Supabase reads
  (rows typed `{}` behind `as any`-ish casts) — regenerate
  `integrations/supabase/types` and type those queries.
- Structured logging/alerting for edge functions (PHASE10 "optional
  polish") — still absent; today debugging relies on `console.error` in
  function logs.
- `bunfig.toml` + Vercel/Cloudflare configs coexist (`wrangler.jsonc`,
  `@cloudflare/vite-plugin`); document the actual deploy path in README.

---

## 7. Recommended order of attack

1. **Rotate + purge the service-role key** (§2.1) — do this today.
2. Fix the four legacy-landing redirects (§3) — four one-line changes,
   biggest UX win per line of code in the repo.
3. Delete `package-lock.json` + `bun.lockb`, standardize on bun (§2.2).
4. Delete dead routes (blog, approvals, galaxy), retire `app.dashboard`
   behind a redirect to `/app` (§4.1).
5. DRY the mission definitions into one shared module consumed by both
   edge functions and the frontend (§5.1.1).
6. Migrate the 14 raw `supabase.functions.invoke` call sites to
   `invokeEdge` (§4.5).
7. Burn down design-token warnings; flip the rule to `error` (§4.4).
8. Lock edge-function CORS to the app origin (§5.2).
9. One interactive QA session to tick the PHASE10 "Wired" checklist, and
   set the operator secrets/pg_cron to bring email/SMS/scheduling live
   (§5.1.4–5).
