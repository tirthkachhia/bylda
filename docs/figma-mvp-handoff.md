# Figma-only MVP: implementation and Theo handoff

The Figma MVP replaces the earlier mixed-design implementation. The branch is
published as [PR #5](https://github.com/tirthkachhia/bylda/pull/5) and has a Vercel
preview. It has not been merged into `main`. Backend functions, migrations,
workers, analysis rules and dependency versions are unchanged.

**The full Figma is not implemented.** The pre-merge audit found 101 prototype
screens: 8 mapped, 35 partial and 58 missing. Disabled navigation and generic
placeholders do not count as completed screens. See
[the complete screen inventory and merge blockers](./premerge-figma-audit.md).

## Presentation retired

- Removed the bodies of 68 historical authenticated pages. Their retained URLs
  redirect to an appropriate MVP destination or Home; they cannot render the old
  page. This includes old CRM/Accounts, Deal Memory, activity/ROI reports,
  founder missions, tutorials, builders, workflows, academy and legacy billing.
- Removed 83 unreferenced legacy UI components and the old blueprint/global
  metallic styling. Reusable UI primitives remain.
- Removed the old public landing/pricing/demo, booking and form presentations;
  their URLs now redirect into the MVP or signup. Public booking/lead-form flows
  are not part of this frontend. No associated backend/data was deleted.
- Removed old theme/palette overrides and the production demo identity / admin
  impersonation overrides. Production auth now exposes only the real session and
  its membership. Password login, signup, email verification, recovery and
  invitation handling remain. Invited-organization selection still needs a
  matching context contract and live acceptance; the oldest membership may be a
  signup-created personal organization.
- Removed the legacy score gauges and temperature curve. Existing exchange
  learning moments use new evidence cards, proper unknown times and playback.

The UI uses Figma's light workspace, typography, rail/sidebar, settings navigation,
source lists, report/team tables and authentication artwork. Unsupported widgets
remain visibly inactive, with unknown values shown as `—` rather than sample data.
The prototype's illustrative prices, counts, people and trend lines do not ship.

## Existing backend capabilities connected

| UI                        | Existing source / action                                                                     | Boundary                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                      | Calls, call insights, rep records and coaching reports                                       | Real workspace counts/recent items, not team behavioral patterns. Reports render even when the insight feed is empty.                                                                                 |
| Calls / filters           | Organization-scoped calls, CRM contacts/leads, transcripts and insights                      | Paginated. Rep/date scope server-side; text/status/stage/family filters apply to loaded calls and say so.                                                                                             |
| Rep directory             | Active reps and paginated, date-scoped call records                                          | Exact observed 30-day call counts. No attention rankings, trajectories or coaching-assignment state inferred from counts.                                                                             |
| Behavioral review         | Retained runs, events, source snapshots and reviewer feedback                                | Six separate judgments; source run/event/turn identity, uncertainty and coverage preserved. No verified commercial outcome or compliance claim.                                                       |
| Timeline                  | Retained event evidence and available call duration                                          | Clicking an event focuses its reasoning and source turn. Stage/talk/control/sentiment tracks remain empty and inactive.                                                                               |
| Playback                  | Stored signed audio or HTTPS provider recording reference                                    | Seek, speed, skip and transcript fallback. Unknown time never becomes zero.                                                                                                                           |
| Media / TXT import        | Existing storage + `import-call` + `analyze-call`                                            | Media limit remains 100 MB. TXT uses the existing supplied-transcript API, up to 100,000 characters, with consent. Text is not uploaded to audio storage. No VTT parser was added.                    |
| Learning moments          | Existing exchange rows and learning-moment explanations                                      | Known source times navigate playback; unknown times are disabled. Exchange IDs are never invented as behavioral turn IDs.                                                                             |
| Per-rep trends            | Existing retained history and comparison helper                                              | Existing model/prompt/taxonomy/context/review/sample gates unchanged. Not a team composite or causal result.                                                                                          |
| Reports                   | Existing coaching report history and `coaching-report`                                       | Report history/view selection uses URL state and scoped historical links can read archived reps. Exact legacy citations retain the report ID; missing immutable run provenance is disclosed.          |
| Manager conversation held | `markReportDelivered` / `coaching_reports.delivered_at`                                      | Permission-gated manager attestation, not externally verified completion or an assignment lifecycle.                                                                                                  |
| Methodology               | Playbook heads, immutable versions and extracted guidelines                                  | Create/save/restore/archive, extraction and existing rep assignment. Partial drafts prompt before leaving; incomplete content cannot save.                                                            |
| Workspace/profile         | Existing organization owner update and self-profile update                                   | No domain joins, workspace timezone or profile-photo upload invented. Workspace name save verifies an updated row.                                                                                    |
| Users / roles             | `list_org_members`, `team-invite`, existing membership writes                                | Existing account roles only. The Figma Manager/Rep/Viewer/Coach capability matrix remains inactive and is not presented as enforced policy.                                                           |
| Notifications             | Existing account notification rows and `read` field                                          | Real unread indicator and mark-read actions. No new behavioral alert generator or delivery preferences were added.                                                                                    |
| Integrations              | Existing provider connection, credential, disconnect and supported sync APIs                 | ReadyMode, Close, HubSpot, Salesforce and GoHighLevel paths retained. Google Calendar/Slack account connection does not imply recorder ingestion or report delivery.                                  |
| Billing                   | Existing subscription/entitlements, `manage-subscription` billing portal and `list-invoices` | Existing account plan, authorized portal and actual invoice PDF URLs work. Figma's per-seat tier cards remain inactive until billing products match.                                                  |
| Workspace setup           | Existing `complete-onboarding`                                                               | Company, team size and industry use accepted existing fields. Auto-created owner membership no longer bypasses incomplete setup. No new role assignment, sales-motion preference or provisioning API. |

Re-analysis/delete/import refresh the relevant call, Home, score/history and rep
count caches. Processing completion refreshes score/history data while immutable
retained runs keep their identities.

## Inactive Figma controls for Theo

These are dependency descriptions for the existing design, not new feature
recommendations. No substitute backend implementation was created.

| Figma surface                                                       | Missing matching contract / required clarification                                                                                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace switcher                                                  | Current auth context selects one membership; there is no existing switch action/context contract. The chevron control is disabled.                                                        |
| Pinned/saved views                                                  | Saved filter persistence, review-seen state and view counts.                                                                                                                              |
| Rooms/messages, notes, share/clip controls                          | Room/message/clip identities, call/analysis-scoped notes and access/sharing contracts. Contact notes and review corrections are different records.                                        |
| Ask Bylda / broad search                                            | Behavioral question/search contract across calls, reps and patterns. Old general business/agent workflows are not used as a substitute.                                                   |
| Stage/talk/control/sentiment timeline and measured behavior widgets | Validated measured series for stage boundaries, WPM, pauses, interruptions, monologues, question counts, control and sentiment.                                                           |
| Team Intelligence / People attention and trajectories               | Team grouping, baselines, composites, recurring-pattern lifecycle, comparable team metrics and outcome relationships. Per-rep comparisons already work separately.                        |
| Coaching assignments                                                | Assignment, rep acknowledgement, check-in, follow-up and measured-change lifecycle. The basic manager-held report action already exists and is connected.                                 |
| Rep-private experience                                              | Rep account linkage and corresponding access/visibility policy. Rep database records do not establish self-service identity.                                                              |
| Report types/scheduling/sharing/delivery                            | Daily/team/behavior report contracts, scheduling, report-specific sharing, PDF generation and Slack/email delivery. Existing rep reports remain usable.                                   |
| Settings Teams / permission matrix                                  | Actual team model, routing, team methodology, future role types and rep-privacy enforcement. Existing organization membership roles are managed in Users.                                 |
| Analysis preferences / rule libraries                               | Persisted configurable analysis preferences, behavior rules, objection library and success criteria. Current backend analysis rules were not altered.                                     |
| Retention/privacy / exports / DPA                                   | Matching retention schedules, redaction policy, export jobs, deletion requests and document sources. No delayed deletion or privacy guarantee is implied by a generic database operation. |
| Notification preferences                                            | Personal/channel preferences, quiet hours and batching; existing notification read state remains supported.                                                                               |
| Photos / workspace domain / timezone / API keys                     | Matching upload, join-domain, workspace-setting and developer-key workflows. Calendar timezone and third-party credentials are not substitutes.                                           |
| Zoom/Gong/Aircall/Meet recorder connections / VTT / outcome CSV     | Matching ingestion/parser/import pipelines. Generic OAuth plumbing alone does not establish recorder support.                                                                             |
| Figma Free/Team/Growth/Scale seat pricing                           | Approved mapping to existing billing products, analyzed seats and entitlements. The design labels its prices as placeholders; no new SKU, price or charge behavior was created.           |

## Verification and preview

The local gallery at `http://127.0.0.1:4319/gallery.html` now shows only the new
MVP. Its isolated entry/data adapter and synthetic audio live outside this repo.
The banner identifies sample data and no live writes. The real app does not import
that adapter or bypass authentication.

- All 434 tests across 57 files pass after pre-merge auth fixes. TypeScript and production client/server build pass.
- Changed-file ESLint reports zero errors; the pre-existing provider/hook Fast Refresh warning remains in the auth module.
- Automated coverage includes the seven prior wiring gaps, exact provenance,
  unknown/zero times, TXT limits, pagination/scoping, inactive controls and real
  auth identity despite retired demo state.
- Desktop/mobile browser checks cover the new primary screens, authentication,
  settings/users/integrations/notifications/billing and retired URL redirects.
- The browser verifies manager-held state, report URL refresh, report-only Home,
  notification read state, owner settings save, existing invoice links, partial
  draft protection and Figma artwork geometry using isolated local fixtures.
- Real media playback was checked with a real media element and synthetic audio;
  production storage access and signed URL authorization still require live QA.

Before any release, perform authenticated acceptance against the deployed backend:
RLS/roles, upload/TXT analysis completion, real recording access, reviewer writes,
report generation, playbook writes, connector configuration and billing/invoice
access. Local fixtures and passing tests do not establish deployment readiness.
No live customer writes, billing actions, connector changes or messages were sent.
