# Bylda Launchpad

An AI-native business operating system. Two modes share one platform:

- **Launchpad** — create & launch: validate an idea, build the offer, land first customers.
- **BYLDA** — operate & scale: automate, optimize, and grow an existing business.

The active mode is backed by `workspaces.mode` and switchable in the sidebar
(`src/components/app/ViewSwitcher.tsx`).

## Stack

- **Frontend:** React 19 + TypeScript, TanStack Start / Router / Query, Tailwind v4, Radix UI.
- **Backend:** Supabase (Postgres + Auth + RLS), 28 Edge Functions (Deno), 8 Cloudflare Workers.
- **Automation:** n8n workflows. **Payments:** Stripe. **AI:** Anthropic (via Cloudflare AI Gateway).
- **Hosting:** Cloudflare Workers (app) + Supabase (data/functions).

## Repository layout

| Path                   | What's there                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| `src/routes/`          | Pages (TanStack file-based routing, `app.*` = authenticated app)            |
| `src/components/`      | UI + app shell (`AppSidebar`, `ViewSwitcher`, dashboard cards)              |
| `src/lib/`             | Client logic: `queries.ts`, `catalog.ts`, `lead-scoring.ts`, guidance, auth |
| `src/hooks/`           | React hooks (`use-workspace-mode.ts`)                                       |
| `supabase/migrations/` | SQL schema (RLS-first; idempotent)                                          |
| `supabase/functions/`  | Edge Functions (`run-tool`, `bylda-chat`, `complete-onboarding`, …)         |
| `workers/`             | Cloudflare Workers (`bylda-contacts-api`, `bylda-stripe-api`, …)            |
| `n8n/`                 | Automation workflow definitions                                             |
| `GAP_ANALYSIS.md`      | CRM-vs-HubSpot + scale roadmap (built vs deferred)                          |

## Local development

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env   # fill in the values below
bun run dev            # http://localhost:3000
```

### Environment

Client (Vite, `VITE_`-prefixed) and server values are documented in `.env.example`.
Minimum to boot the app: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Optional:
`VITE_SENTRY_DSN` enables client error tracking (no-op when unset).

## Scripts

| Command                | Purpose             |
| ---------------------- | ------------------- |
| `bun run dev`          | Dev server          |
| `bun run build`        | Production build    |
| `bun run tsc --noEmit` | Type-check          |
| `bun run test`         | Unit tests (Vitest) |
| `bun run lint`         | ESLint              |
| `bun run format`       | Prettier write      |

## Testing

Unit tests live in `src/**/__tests__` and run on [Vitest](https://vitest.dev) (`bun run test`).
They cover pure logic — lead scoring, lane classification, tool gating, step guidance. Add
tests alongside new pure modules; prefer pure functions so logic stays testable without mocks.

## CI / CD

- **CI** (`.github/workflows/ci.yml`, on PRs to `main`): type-check → test → build, plus lint.
- **Deploy** (`.github/workflows/deploy.yml`, on push to `main`): reconciles migration history,
  runs `supabase db push`, deploys Edge Functions, then deploys the app to Cloudflare Workers.

> Merging to `main` deploys to production. Migrations must be additive/idempotent — the deploy
> reconciles out-of-band schema drift before pushing.
