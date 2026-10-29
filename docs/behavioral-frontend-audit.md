# Local frontend design and wiring audit

> Superseded by the [Figma-only MVP implementation and Theo handoff](figma-mvp-handoff.md).
> The mixed-design state and remaining gaps below describe the earlier audit, not the current UI.

Audited implementation: `feat/behavioral-figma-integration`, code commit `2300363`.
Main remains `1760fb7`. This is a read-only product-code audit; nothing was pushed,
merged to main or deployed. The preview uses real screen components with isolated
sample data. It does not demonstrate that production migrations or permissions
are deployed correctly.

## Conclusion

The new shell and the core calls/manager surfaces are implemented and connected
to existing query/action adapters. They are **not a complete reproduction of all
Figma screens**. Several pages retain older bodies, some Figma controls depend
on unsupported data, and the concrete frontend gaps below remain.

In particular, the previous pass was wrong to remove the manager's basic
"conversation held" control as unsupported. The migration explicitly defines
`delivered_at` as that manager-recorded timestamp. This is an attestation; it does
not establish verified behavior change or a complete coaching-assignment lifecycle.

## Preview

Local server: `http://127.0.0.1:4319/app`.
A fixed banner identifies sample data and no live writes. This temporary entry
and its data adapter live outside the application repository. The real app's
login protection has not been bypassed or changed.

Useful destinations:

| Screen                | Local path                                               |
| --------------------- | -------------------------------------------------------- |
| Home                  | `/app`                                                   |
| Calls                 | `/app/crm/calls`                                         |
| Call review           | `/app/crm/calls?callId=call-1&repId=rep`                 |
| Rep profile           | `/app/crm/calls?view=people&repId=rep`                   |
| Per-rep trends        | `/app/crm/calls?view=insights&repId=rep`                 |
| Coaching report       | `/app/crm/calls?view=report&repId=rep&reportId=report-1` |
| Methodology           | `/app/crm/calls?view=playbooks`                          |
| Old Settings body     | `/app/settings`                                          |
| Old Integrations body | `/app/integrations`                                      |
| Old reporting product | `/app/bylda/reports`                                     |

The preview includes these real legacy page components as well as Accounts,
Deal Memory and CRM Setup, so the remaining visual differences can be inspected.
Preview saves and backend-dependent actions are not live acceptance tests.

## What has been placed and connected

"Connected" here means the production component has a real query/action adapter;
it does not mean that a live customer write was performed during this audit.

| Area                | New UI in place                                                               | Wiring                                                                               | Figma fidelity / practical limit                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell               | Rail, sidebar, light gradient, Inter, local assets, mobile menu               | Actual navigation, call search/upload links and existing sign-out                    | Updated visual foundation. Search is call search; workspace card links to Settings rather than switching organizations. No notification center, rooms or saved-view menu.                           |
| Home                | Feed cards, rep list, recent calls and summary panel                          | Organization-scoped calls/insights/reports and real totals                           | Feed is recent single-call analyses and reports. Figma's team patterns, live activity, coaching queue and daily trend widgets are absent. All-time counts are labelled accordingly.                 |
| Calls               | Table, search, rep/date/status/family/stage controls                          | Paginated scoped hydration and source selection                                      | Rep/date query server-side. Text, CRM stage, status and family filter the loaded pages. No saved views, review-seen state or persistent pinning.                                                    |
| Call review         | Summary, transcript, moment cards, analysis, methodology and Diagnostics      | Run/event/turn identity, immutable snapshots, evidence selection, re-analysis/delete | Adapted layout with horizontal page tabs. Figma's combined stage/event/talk/control/sentiment timeline is absent. No call-level note/share/assign-coaching workflow.                                |
| Behavioral evidence | Six separate judgments and the three retained families                        | Quotes, source IDs, confidence, uncertainty, alternatives, coverage and feedback     | Core behavioral source links work. Unknowns are preserved. This does not produce verified outcomes or compliance decisions.                                                                         |
| Recording           | Play/pause, scrub, speed and skip controls                                    | Signed audio or HTTPS recording reference; source seek and transcript fallback       | Functional player, not the Figma multi-track analytics timeline.                                                                                                                                    |
| People / Insights   | Rep selector, profile cards, evidence and guarded Trends                      | Retained history/events, reviewer feedback and comparison helper                     | Per-rep view; not Figma's team directory analytics, team pattern detail or comparison matrix.                                                                                                       |
| Coaching reports    | History, report generation controls, patterns, strengths, drill and citations | Existing `coaching-report`, report history and timestamp navigation                  | Existing manager report adapted to new shell. Not the Figma rep-private weekly report with acknowledgement, assignment status, PDF or share controls. Basic manager-held control needs restoration. |
| Methodology         | Index, text editor, Guidelines and Versions tabs                              | Create/save/restore/archive/extract and existing rep assignment                      | Saved text plus extracted guidelines; not the Figma structured stage editor/toggles.                                                                                                                |

## Frontend wiring gaps to fix before calling the supported scope finished

| Priority | Finding                                                                                 | Evidence                                                                                                                                                                                                                                                                                                               | Classification / work needed                                                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Manager-held action was removed incorrectly.                                            | `20261019000004_coaching_reports_followup.sql` defines `delivered_at` as the manager having the conversation. `20261027000001_behavior_intelligence.sql` grants manager/owner/admin update only to this column. `src/lib/queries.ts:1983` still exposes `markReportDelivered`; `RepReportPanel` no longer consumes it. | **Backend exists but frontend mapping is missing.** Restore the permission-gated manager attestation and report invalidation; do not imply assignment/rep acknowledgement or externally verified completion. The current test asserting that the control is absent also needs correction. |
| 1        | Unknown legacy Diagnostics times render as `00:00`.                                     | `src/components/app/coaching/CallScores.tsx:36` uses `Math.round(n(s) ?? 0)`. `call_exchange_scores.start_s` is nullable. Core snapshot timestamps do not have this bug.                                                                                                                                               | **Partial. Frontend transformation fix.** Render unknown as unknown and disable timed actions when no usable time exists.                                                                                                                                                                 |
| 1        | Home hides existing reports when there are no insights.                                 | `TodayBrief.tsx:86` takes the empty-state branch before rendering reports. Reproduced with reports present and `call_insights` empty: zero "View report" links.                                                                                                                                                        | **Partial. Frontend condition fix.** Render report data independently of insight availability. No backend work.                                                                                                                                                                           |
| 2        | Diagnostics learning moments show plain time text with no playback callback.            | `CallScores.tsx:319` renders a span. `CallDetail` supplies only `callId` to `CallScores`. Scores already carry exchange start times.                                                                                                                                                                                   | **Backend exists but frontend mapping is missing.** Connect valid legacy times to playback/transcript navigation; do not invent source turn/run IDs. Fix unknown-time handling first.                                                                                                     |
| 2        | Profile/Reports toggles and history selection do not update route state.                | `RepReportPanel.tsx:56` / `:61` keep local state. Reproduced: click Reports from `view=people`; URL stays `view=people`; refresh returns to profile.                                                                                                                                                                   | **Partial. Frontend navigation wiring.** Reuse existing `view` and `reportId` search contract. No new backend or saved-view persistence needed.                                                                                                                                           |
| 2        | Calls refresh does not explicitly refresh behavior history or Diagnostics score caches. | `app.crm.calls.tsx:164` invalidates calls, selected call and Home only. `call-scores` has a 15-second stale window; the already-mounted Diagnostics query is not explicitly invalidated as processing completes.                                                                                                       | **Partial. Frontend query integration.** Invalidate affected score/history keys on relevant completion/delete paths. New retained runs remain immutable and should not be overwritten. This is a code-review finding; stale-data timing was not reproduced against a live worker.         |
| 3        | New-playbook unsaved check misses partial drafts.                                       | `PlaybooksPanel.tsx:102` requires both name and content for `dirty`; a name-only draft is not protected by its Back action. Sidebar departure also has no route leave guard.                                                                                                                                           | **Partial. Frontend form guard.** Protect actual edited drafts using the existing editor. No backend change.                                                                                                                                                                              |

Calls search is intentionally limited to loaded calls and labelled that way. It
is functional within that scope, but does not satisfy the broader Figma global
search across calls, people and insights. Full-dataset filter/search semantics
need an agreed query implementation; they are not fixed by changing a label.

## What still uses the old design

These are reachable pages, not merely unused files discovered in a search.
Shared CSS changes some fonts, colors and radii; it does not replace their bodies.

| Existing route / component                          | Remaining old UI                                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/settings` — `app.settings.tsx`                | Old settings tab structure, profile forms, metallic gradient Save control, billing/team/connectors/danger panels. Header currently says "Workspace" rather than Settings.                                     |
| `/app/integrations` — `app.integrations.tsx`        | Existing catalog, category filters and connector dialogs. It is not a new behavioral-intelligence settings screen.                                                                                            |
| `/app/contacts` — `app.contacts.tsx`                | Old account/contact table, profile drawer, tags, lead scores and CRM interactions. This is Accounts; the new People entry is reps.                                                                            |
| `/app/memory` — `app.memory.tsx` / `BusinessMemory` | Existing knowledge base, sources and query interface. Rail "Ask Bylda" leads here, not a new Figma conversational flow.                                                                                       |
| `/app/crm/setup` — `app.crm.setup.tsx`              | Existing sales-profile questionnaire and summary.                                                                                                                                                             |
| `/app/bylda/reports` — `app.bylda.reports.tsx`      | Old activity/ROI reporting, generations, run health and weekly operating review; separate from the new coaching report entry. Both remain accessible.                                                         |
| Diagnostics — `CallScores.tsx`                      | Existing exchange score gauges, customer-temperature/rep-move curve and learning-moment rows. It is labelled legacy and kept behind the Diagnostics tab; it is not the new Figma sentiment/control analytics. |
| `/app/playbook` — `app.playbook.tsx`                | Old founder mission history, not sales Methodology. Not exposed as the new Methodology nav destination.                                                                                                       |
| Auth/public/demo and other historical deep links    | Untouched by this branch; they should not be counted as migrated just because the authenticated app has a new shell.                                                                                          |

No deletion or automatic migration of those routes was performed during this
audit. Existing workflows should not be removed merely to make the codebase look
fully migrated.

## Figma elements still unsupported by the current contracts

| Figma element                                                                                             | Current boundary                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WPM, precise pauses/interruptions/questions/monologues and stage/talk/control/sentiment timelines         | Structured turns and qualitative model judgments exist; validated measured series for those widgets do not. Legacy temperature is not a sentiment/control substitute.     |
| Team recurring-pattern feed, team baseline/comparison matrix, pattern lifecycle and causal outcome claims | Per-rep comparable events/trends exist with gates; the complete team data products do not.                                                                                |
| Assignment, rep acknowledgement, check-in scheduling and measured coaching lifecycle                      | Basic manager-held report timestamp exists. The rest of the illustrated lifecycle does not.                                                                               |
| Rep-private weekly experience                                                                             | Rep records exist, but the Figma self-service identity/access flow is not implemented.                                                                                    |
| Saved views, review-seen/pinned counts, rooms, notes/sharing attached to the exact analysis source        | No matching complete persistence/navigation contracts were found. Contact notes and reviewer correction text are not substitutes for call-sharing or call-note workflows. |
| Share with manager, clip/room sharing, PDF export and report email/Slack delivery                         | Those report-specific frontend flows are absent; they cannot be inferred from unrelated generic integrations.                                                             |
| Verified outcome/compliance, confirmed recording completeness                                             | Transcript observations, review flags and coverage are available; authoritative external confirmation is not.                                                             |

## Checks actually performed

- Reused the earlier high-fidelity Figma contexts for Home, Calls, Call Review,
  Overview/Analysis, Methodology and Weekly Rep Report.
- Reviewed the local source diff against main, active shell links, queries,
  backend migrations and exact UI event handlers.
- Rendered current Home/Calls/Review/Profile/Report/Methodology at desktop and
  mobile sizes; exact source-turn navigation, audio seek/speed and asset loading
  passed with isolated fixtures. No page errors in that core screen pass.
- Rendered old Settings, Integrations, Accounts, Reports, Memory and CRM Setup
  bodies inside the new shell. No connector or customer writes were executed.
- Reproduced report-only Home hiding and profile/report refresh mismatch.
- Prior code commit: 414 tests, TypeScript, changed-file lint and build passed.
  No production code changed in this audit, so those checks were not rerun.
- Live authentication, migrations/RLS, real upload/analysis completion, reviewer
  writes, real report generation and playbook writes still need authenticated
  backend acceptance. A working fixture preview does not close those checks.

## Merge recommendation

Keep this local while the priority 1 and 2 frontend gaps are addressed and the
remaining visual differences are reviewed. Do not describe the entire product
as fully migrated to Figma. The unsupported widgets above should remain inactive
rather than acquire placeholder numbers during cleanup.
