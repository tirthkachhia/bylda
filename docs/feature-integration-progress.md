# Evidence-backed coaching integration and rollout

Base: main `4d82419`. Branch: `codex/call-timeline-notes`.

## Implemented

| Area | Result |
| --- | --- |
| Call review | Five clickable Stage, Events, Talk, Control and Sentiment tracks derived from retained source snapshots. Unknown source annotations remain explicitly unknown. Talk intervals are unioned; control means question/response lead, and tone remains a transcript annotation rather than a measured emotion. |
| Re-analysis | Default mode uses saved transcript text and invokes only analysis. Explicit rescoring uses saved structured turns. Neither mode downloads audio or runs transcription; a missing transcript returns an actionable error. |
| Notes and coaching | Shared persisted call notes, author-only edits/deletes, edit conflict detection, manager assignments, source attachments, check-ins and completion/reopening. |
| Call and rep breakdown | Specific strengths, concerns, observed buyer responses, qualified interpretations and actions. Optional new coaching topics/priorities are generated on new analysis. Historical events are not relabeled by keyword. No fabricated sample rates or causal revenue claims. |
| Review boundaries | Manager-rejected/disputed/unhelpful observations are withheld from report recommendations. Latest feedback per reviewer is respected. Retained-run moments replace legacy moments for the same call. Workspace confidence settings apply to call, rep and report recommendations. |
| Insights | Counts actual uploaded/imported calls independently of connected providers; scoped errors are distinct from true empty workspaces. Reviewed comparable opportunities drive trend claims. |
| Workspace workflows | Verified workspace switching, saved teams, private/workspace rooms and messages, search, memory-backed Ask Bylda, assignment-backed Today brief and People comparisons/export. Prototype links route to supported live workflows. |
| Reports | Private source links, daily/weekly UTC schedules, leased/idempotent occurrences, visible failures, in-app notifications and encrypted delivery destinations. |
| Delivery | Queued Slack, Teams, email and allowlisted HTTPS webhook report-ready links. Provider acceptance is recorded separately from recipient reading. An interrupted send is not automatically duplicated; manual retry warns about uncertainty. |
| Settings | Real organization/profile editing, profile photo, authenticator enrollment and app sign-in challenge, other-session revocation, OAuth buttons, notification preferences, analysis language/history/timezone/confidence, versioned guidance libraries, audit export and read-only API keys. |
| Billing and usage | Configured Stripe catalog, checkout and existing billing portal/invoices, stored audio sizes and analyzed seats. Existing subscriptions use the portal rather than another checkout. |
| Data controls | Scoped JSON export, append-only manager-recorded outcome CSV import, owner-confirmed workspace deletion and durable storage cleanup. Credentials and private room data are excluded from broad workspace exports. |
| Recorder setup | Real standardized transcript webhook/file ingestion instructions, without claiming native recorder synchronization. |

All eight migrations enforce workspace access in PostgreSQL, including private room membership, note author ownership and manager-only assignment/configuration writes. Shared notes do not overwrite immutable AI analysis or feedback.

## Rollout order

These changes have not been deployed or applied to production by this work.

1. Apply migrations `20261103000001` through `20261103000008` in order. Existing behavioral-data, integration-secret, report and notification schemas must already be installed.
2. Deploy updated Edge Functions: `analyze-call`, `coaching-report`, `coaching-rescore`; new functions: `coaching-scheduled-reports`, `coaching-api-keys`, `coaching-api`, `coaching-data-controls`, `coaching-billing-catalog`, `coaching-delivery-channels`. Retain the checked-in `verify_jwt` settings. The scheduler authenticates with the worker secret; the read-only API authenticates hashed API keys.
3. Deploy `workers/bylda-coaching-transcriber/wrangler.jsonc` after the schema/functions are ready. This adds `kind: analyze` routing and a minute cron. Existing queues and secrets are reused. A GitHub frontend deployment does not deploy this Worker.
4. Deploy the frontend. The new re-analysis action requires the new worker. Missing migrations/configuration surface errors rather than pretending to save successfully.
5. Verify a source-backed call, notes across reload, uploaded-call Insights, transcript-only re-analysis, assignment permissions and one scheduled report in staging before enabling production delivery channels.

Configuration: existing `COACHING_WORKER_SECRET`, `COACHING_WORKER_URL`, Supabase service credentials and model provider configuration remain required. Encrypted delivery requires existing `INTEGRATIONS_ENCRYPTION_KEY`. Email requires `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`. Generic webhooks require the exact server-side `COACHING_WEBHOOK_ALLOWED_HOSTS` allowlist. `APP_PUBLIC_URL` can override the default report-link origin. Stripe requires configured environment keys, public client keys and supported lookup-key products. Google/Azure OAuth require provider configuration and allowed redirect URLs in Supabase. Webhook ingestion requires the existing inbound secret.

The minute scheduler handles one delivery or one report per invocation; busy queues can delay execution. Failed report occurrences show their error and advance to the next cadence. A manually generated report remains a recovery path. A report save can succeed while delivery enqueue fails; that condition is logged and requires operational recovery. No timeout increase bypasses Cloudflare proxy limits.

## Explicit limits and dependencies

- Native continuous sync for each prototype recorder is not implemented; file upload and standardized transcript webhooks are functional entry points.
- Mobile push, quiet-hour delivery batching, verified-domain auto-join, arbitrary per-rep privacy policies, scheduled retention/PII redaction and comprehensive person-erasure workflows are not implemented. Supported settings are shown instead of inert toggles.
- Workspace deletion removes database records first, then queues audio removal. It does not erase external provider copies, backups or third-party billing records. Cleanup completion is asynchronous.
- Authenticator verification gates the app UI after password/OAuth sign-in. This change does not globally add an AAL2 requirement to every existing database/Edge API policy. Server-enforced MFA policy across all APIs remains separate security work.
- Some specialized prototype screens now open the corresponding real workflow instead of having a distinct specialized layout. Removing a placeholder does not imply every prototype concept has its own engine.
- Outcome imports are attributed manager records, not independently verified commercial outcomes. They are displayed separately and are not yet a causal outcome-learning or automatic model-training pipeline.
- Existing analyzed calls need transcript-only re-analysis to receive new prompt-generated topic/priority fields. No live LLM quality evaluation or customer-data re-analysis was performed for this change.
- Source timestamps are retained transcript estimates. Missing stage, tone or timing data is not fabricated. Analysis-only retries can create another immutable run if an earlier successful response was lost; they never transcribe audio again.
- No live OAuth login, Stripe purchase, external message delivery, workspace deletion or production migration was performed during verification.

## Verification

- Full Vitest suite: 483 tests across 67 files pass, including real PostgreSQL/RLS fixtures for the eight migrations, notes persistence/conflicts, five-track source validation, uploaded-call Insights, feedback eligibility and transcript-only queue behavior.
- App TypeScript and all nine changed/new Edge entrypoints pass type checks.
- Changed frontend files pass ESLint, with one existing auth Fast Refresh warning.
- Worker deployment dry-run bundles successfully. Production frontend build passes (client, SSR and Vercel output).
