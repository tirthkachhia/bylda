# Audit recovery and app motion

Based on the supplied November 12 audit summary and its exact source commit, `d72e44d7e40e18bc44c951e3456b4cbeccc6f275`. Changes are in the separate `codex/audit-recovery-motion` worktree at `C:/Users/parit/Documents/bylda-audit-recovery`; the original checkout and its edits were preserved.

## Implemented

| Audit area | Change |
| --- | --- |
| SEC-01 / OPS-01 | Server-maintained, immutable recording bindings. An uploader can sign a new unbound file before insertion. Once attached, access follows the source call. Forged references, identity changes and inaccessible recording deletion are blocked. Historical bindings require the original org/uploader/call path contract. |
| SEC-02 | Memory artifacts, transcript chunks and delivery logs follow source visibility. Call artifact identity cannot be rewritten to remove its source boundary. |
| MFA | Enrolled accounts require AAL2 at the database and protected admin/invitation endpoints, in addition to the frontend challenge. Service queue jobs remain server-authorized. |
| OPS-02 / OPS-03 | Scoring hands off to a separate retryable analysis message. Failed analysis retries and records terminal failure. Atomic transcription claims prevent competing deliveries from transcribing the same recording; saved transcripts are reused. |
| AI-01 | Independent model review checks source-linked event, dimension and final-state claims. Missing or unsupported reviews withhold claims; malformed/provider-failed reviews fail the run. Explicit buyer rejection cannot normalize as a successful commitment. This is an additional validation gate, not a measured production accuracy guarantee. |
| AI-02 / AI-03 | Explicit text/provider speaker roles survive extraction. Unknown speech is not attributed to a customer or rep. Missing times remain null, invalid clock values are rejected, source order is preserved, and missing tone remains unknown. |
| AI-04 / AI-05 / AI-06 | Behavioral calls no longer require exchange scores to enter reports. Missing scores/value/risk labels remain unavailable. Strengths need valid citations. Report context retains progression, limitations and final-state provenance. A separate evidence pass validates report prose before completion. |
| CHAT-01 / CHAT-02 | Ask retrieves authorized source snapshots on the server, validates citation IDs and reviews answer support. Answers show exact quotations with links to call/run/turn. Private question history persists and is hidden when source-call access is lost. Previous questions provide context, never evidence. |
| CRM-03 / CRM-04 | Exact 20-point trend thresholds agree in both directions. Changed rep cohorts are excluded. Report comparisons require matching analysis/playbook versions, objectives and constraints; unavailable comparisons are disclosed. |
| DEL-01 / DEL-03 | Delivery controls match owner/admin endpoint permissions. Report completion and delivery queue insertion share a transaction. Failed scheduled reports retain the occurrence for retry. Delivery work no longer starves scheduled reports. |
| UX / MOT | Missing talk timing displays unavailable. All routes share screen transitions and section reveals, including auth/setup, loading content, rapid navigation and reduced motion. Playback seeking and text filters do not restart whole-screen animations. |
| ENG | Lint excludes generated build output and the separate prototype project, handles Windows line endings, and fixes the existing source lint failures. CI checks lint, types, tests, build and modified edge functions. |

## Local verification

- Repository tests include actual Postgres-compatible policy execution with owner, manager, agent and outsider identities, forged-reference attempts, first-upload signing, MFA, private history, queue claims and transactional delivery failure.
- All four additive recovery migrations are applied and replayed in the policy fixture.
- Motion tests cover delayed content, cancellation on rapid navigation, retained form controls and reduced motion. Auth navigation was checked in the browser with no console errors.
- Edge functions are checked with Deno against their pinned Supabase import; the app is checked with TypeScript and a production build.
- The separate CRM profile worker test suite is included in release checks.

## Deployment order

1. Apply `20261114000001_recording_evidence_access.sql` through `20261114000004_ask_history.sql` on an isolated stack first.
2. Deploy `analyze-call`, `coaching-ask`, `coaching-report`, `coaching-scheduled-reports`, `team-invite`, and the functions bundling `requireCoachingAdmin`: `coaching-api-keys`, `coaching-billing-catalog`, `coaching-data-controls`, `coaching-delivery-channels`.
3. Deploy the coaching transcriber worker with both existing queue bindings. It now depends on the transcription claim RPCs.
4. Deploy the frontend together with the new Ask endpoint/history schema. Existing Anthropic and Supabase server configuration is required.
5. Run a consented recording through upload, playback, analysis, exact-source Ask, report and delivery as both manager and rep, including an enrolled MFA account and forced provider failure. Record deployed app/function/worker versions.

## Still unverified or outside the supplied detail

No infrastructure, database, provider messages or production data were changed. Authenticated live/provider journeys, model accuracy on reviewer-labelled real calls, cross-browser/device performance, external outcome attribution and supervised rep/manager usefulness still require connected-stack evidence. Existing stored analysis and reports are not retroactively corrected by a code change.

The pasted summary links a separate 33-finding issue register and design/accuracy evidence that were not included. This change addresses the concrete defects described in that summary; it does not certify every unspecified issue or establish complete design parity. The behavioral outcome graph and broader business-outcome integrations remain unimplemented.

Independent evidence review adds model requests and may reject more outputs. Historical recording references outside the validated upload path contract require explicit investigation and trusted repair rather than automatic rebinding.
