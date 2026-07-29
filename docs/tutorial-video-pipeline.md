# Tutorial Video Pipeline

How the `/app/tutorials` videos are produced. There are two kinds of asset:

1. **25 step-by-step tutorials** — real screen recordings that actually _operate_
   the app (create a deal, drag the kanban, build an automation, connect Slack,
   generate real AI content), one per row in `public.tutorials`.
2. **1 cinematic brand film** — the hero promo at the top of the tutorials page
   (`tutorial-videos/promo/bylda-brand-film.mp4`). See `docs/promo-film-brief.md`.

## Tutorials — real screen recordings (`scripts/tutorial-videos/`)

- `record.mjs` drives the running app with Playwright + Chromium while recording
  video, so every clip shows the actual operation in its title — not a static
  page. An injected overlay draws a smooth cursor, click ripples, a title card,
  and on-screen captions. Each scenario performs the real flow (fills the New
  Deal form and saves it, drags cards between kanban stages, drags trigger/action
  blocks onto the workflow builder, connects an integration, runs a real
  Launchpad AI tool and waits for the output, etc.).
- AI-generation tutorials (campaigns, email sequences, AI dashboard) trigger the
  real `run-tool` edge function and the encoder speeds up the generation wait
  (`ffStart`/`ffEnd` marks → 14× segment) so the video shows the real output
  without a dead spinner.
- Output is encoded to H.264 MP4 (via system `ffmpeg`) with a JPG poster, then
  `upload.sh` pushes both to the Supabase `tutorial-videos` bucket and points the
  `public.tutorials` row at them (`video_status = 'completed'`,
  `video_provider = 'playwright'`).
- `reset-demo-data.sh` restores the seeded demo org between runs so each
  recording starts from clean, realistic data.

### Running it

Env: `APP_BASE_URL` (default `http://127.0.0.1:8080`), `TUTORIAL_PASSWORD`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, plus a Chromium-capable
`playwright`. Start the dev server (`bun run dev -- --host 127.0.0.1 --port 8080`),
then `node scripts/tutorial-videos/record.mjs all` and
`bash scripts/tutorial-videos/upload.sh`.

### Capturing real screens

- Sign in as a seeded confirmed demo user, then navigate client-side
  (`history.pushState` + `popstate`) — full-page `goto` loses the localStorage
  session and redirects to sign-in.
- Pre-set `localStorage["bylda-rail-open"] = "0"` so the Bylda AI rail doesn't
  cover the page; use `ignoreHTTPSErrors` for the sandbox TLS proxy.

## Schema

`public.tutorials` (see `supabase/migrations/20260612030000_create_tutorials_table.sql`)
is the catalog + queue. The frontend (`src/routes/app.tutorials.tsx`) merges the
DB rows over the static `TUTORIALS` list and renders an MP4 `<video>` for any row
with `video_status = 'completed'` and a `video_url`.

## Status (2026-06-14)

- All **25** tutorials recorded as real-operation screen captures, uploaded, and
  live (`video_provider = 'playwright'`).
- Brand film produced (14 scenes, ~1:34) and surfaced as the tutorials-page hero.
- Fixed two latent bugs found while recording (see
  `supabase/migrations/20260612210000_fix_integration_save.sql` for the
  integration-save `pgcrypto`/`#variable_conflict` fix; `src/lib/mock.ts` for the
  `email-sequence` tool-key mismatch that 404'd the Email Sequence tool).
