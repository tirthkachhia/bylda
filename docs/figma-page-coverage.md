# Figma page presence and backend boundary

Updated 2026-10-29. Signup/authentication work is deferred to Tirth, per the user. This inventory replaces the previous page-presence blocker in `premerge-figma-audit.md`.

## Result

All **96 non-authentication prototype frames** have a frontend destination: 76 Day 0 views, five setup screens, two forms, three panels, and ten existing settings/workspace screens. The five auth frames remain present from earlier work and are unchanged in this pass. This is page coverage, not a claim that all populated Figma states or backend features are implemented.

The new views follow the linked Figma **Day 0** frames: shared empty-state card, original 44px icon, static three-row preview with the original 20px avatar asset, and setup context panel where designed. They deliberately do not display sample people, organizations, metrics, quotes, trends or progress as real data. Unsupported actions stay disabled. The layout-preview rows are static, not a loading/progress signal.

## Existing wiring preserved

- Home, Calls/import/playback/evidence/reviews, per-rep comparisons, rep reports, versioned playbooks, users/settings, integrations and billing retain their existing routes and data adapters.
- Notifications drawer reuses the existing notification reader/mark-read logic. The search panel opens the existing Calls page and its loaded-call filter.
- Setup pages link to supported connection/upload/user-management pages and reuse the existing playbook editor. They do not add a second provisioning API.
- New room/coaching forms never create objects, send messages, assign coaching or claim delivery. Ask Bylda/natural-language results are inactive. Workspace analysis progress, first-insight metrics, team patterns and coaching results remain unknown.
- No backend functions, migrations, workers, rules or dependency versions changed. Signup/auth files are unchanged by this pass.

## Navigation and validation

- Sidebar **Browse views** exposes the views and forms. Existing section tabs link to detail/empty-state pages. Rooms/messages, search, Ask Bylda and notification drawer open their corresponding presentation. Cmd/Ctrl+K opens search.
- 86 newly added view/panel/setup destinations were opened in the browser; every one rendered with no missing assets and no desktop horizontal document overflow. Existing settings pages remain routed as before.
- Mobile-width inspection covers the shared empty-state layout, room form and methodology setup. Dialogs scroll within the viewport; they retain disabled submit controls and working close/cancel navigation.
- Search was exercised against the isolated local adapter and navigates to `/app/crm/calls?view=calls&q=...`. Unsupported room/coaching fields and submit actions were inspected as natively disabled.
- Local checks: **436 tests / 58 files**, TypeScript and production build pass. Changed-file ESLint has zero errors and zero warnings.
- Complete traceability is also stored in `src/lib/figma-screen-manifest.ts`; regression checks require a destination for every audited frame.

Local review gallery: `http://127.0.0.1:4319/page-coverage.html`. It runs on an isolated sample-data adapter outside the repo. It does not establish live backend acceptance. Tirth owns live signup fixes; backend gaps remain for later implementation.

## Frame destinations

| Figma frame                                                                                                                                           | Page                              | Presence                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------- |
| [4121:3 · PROTO · Rep Profile — Jordan Reyes (manager view)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3)                      | /app/views/rep-profile-manager    | Present · Day 0         |
| [4121:173 · PROTO · Call Review — Acme Logistics](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-173)                               | /app/views/call-review            | Present · Day 0         |
| [4121:438 · PROTO · Assign Coaching — modal](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-438)                                    | /app/views/assign-coaching        | Present · inactive form |
| [4121:501 · PROTO · Behavior Detail — Interrupting during objections](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-501)           | /app/views/behavior-detail        | Present · Day 0         |
| [4121:653 · PROTO · Behavior Change Result — Alex Morgan](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-653)                       | /app/views/behavior-change-result | Present · Day 0         |
| [4121:737 · PROTO · Rep Home — Daily Brief](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-737)                                     | /app/views/rep-home               | Present · Day 0         |
| [4121:834 · PROTO · Onboarding — Teach Bylda how you sell](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-834)                      | /setup/methodology                | Present · setup         |
| [4121:1131 · PROTO · Onboarding — Connect calls (integration states)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-1131)          | /setup/connect                    | Present · setup         |
| [4121:1383 · PROTO · Onboarding — Analysis initializing](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-1383)                       | /setup/analysis                   | Present · setup         |
| [4121:1599 · PROTO · Onboarding — First insight](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-1599)                               | /setup/insight                    | Present · setup         |
| [4121:1802 · PROTO · Auth — Sign in](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-1802)                                           | /auth/sign-in                     | Present · auth deferred |
| [4121:1850 · PROTO · Onboarding — Workspace setup](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-1850)                             | /onboarding                       | Present · existing      |
| [4121:2076 · PROTO · Onboarding — Invite team](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2076)                                 | /setup/invite                     | Present · setup         |
| [4121:2354 · PROTO · Coaching — Rep view (Jordan)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2354)                             | /app/views/rep-coaching           | Present · Day 0         |
| [4121:2412 · PROTO · Coaching Detail — Jordan · active](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2412)                        | /app/views/coaching-detail-active | Present · Day 0         |
| [4121:2508 · PROTO · Manager Home — Feed](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2508)                                      | /app/views/manager-feed           | Present · Day 0         |
| [4121:2685 · PROTO · Manager Home — Team Updates](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2685)                              | /app/views/manager-team-updates   | Present · Day 0         |
| [4121:2834 · PROTO · Manager Home — Calls](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2834)                                     | /app/views/manager-calls          | Present · Day 0         |
| [4121:2988 · PROTO · Manager Home — Coaching](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-2988)                                  | /app/views/manager-coaching       | Present · Day 0         |
| [4121:3128 · PROTO · Manager Home — Reports](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3128)                                   | /app/views/manager-reports        | Present · Day 0         |
| [4121:3268 · PROTO · Manager Home — Mentions](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3268)                                  | /app/views/manager-mentions       | Present · Day 0         |
| [4121:3407 · PROTO · Admin Home — Owner (workspace health)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3407)                    | /app/views/workspace-health       | Present · Day 0         |
| [4121:3539 · PROTO · Rep — My progress](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3539)                                        | /app/views/my-progress            | Present · Day 0         |
| [4121:3649 · PROTO · Call Review — Rep perspective](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3649)                            | /app/views/rep-call-review        | Present · Day 0         |
| [4121:3779 · PROTO · Call Review — Overview](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3779)                                   | /app/views/call-overview          | Present · Day 0         |
| [4121:3897 · PROTO · Call Review — Analysis](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-3897)                                   | /app/views/call-analysis          | Present · Day 0         |
| [4121:4039 · PROTO · Call Review — Coaching](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4039)                                   | /app/views/call-coaching          | Present · Day 0         |
| [4121:4114 · PROTO · Calls Index — saved views](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4114)                                | /app/views/calls-saved-views      | Present · Day 0         |
| [4121:4297 · PROTO · Calls Index — All calls + filters open](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4297)                   | /app/views/calls-filters          | Present · Day 0         |
| [4121:4523 · PROTO · Room — #objection-watch](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4523)                                  | /app/views/room-conversation      | Present · Day 0         |
| [4121:4677 · PROTO · Rooms — Directory](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4677)                                        | /app/views/rooms                  | Present · Day 0         |
| [4121:4745 · PROTO · Room — #daily-brief](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4745)                                      | /app/views/room-daily-brief       | Present · Day 0         |
| [4121:4858 · PROTO · Room — #coaching](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4858)                                         | /app/views/room-coaching          | Present · Day 0         |
| [4121:4983 · PROTO · Room — #objection-watch · Insights](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-4983)                       | /app/views/room-insights          | Present · Day 0         |
| [4121:5124 · PROTO · Room — #objection-watch · Calls](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5124)                          | /app/views/room-calls             | Present · Day 0         |
| [4121:5235 · PROTO · Room — #objection-watch · Reports](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5235)                        | /app/views/room-reports           | Present · Day 0         |
| [4121:5339 · PROTO · Room — #objection-watch · Files](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5339)                          | /app/views/room-files             | Present · Day 0         |
| [4121:5488 · PROTO · Room — #objection-watch · About](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5488)                          | /app/views/room-about             | Present · Day 0         |
| [4121:5615 · PROTO · Room — #mid-market-team (team room)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5615)                      | /app/views/team-room              | Present · Day 0         |
| [4121:5760 · PROTO · Direct message — Dana ↔ Jordan](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5760)                           | /app/views/direct-message         | Present · Day 0         |
| [4121:5864 · PROTO · Direct message — BYLDA Coach (rep)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5864)                       | /app/views/coach-message          | Present · Day 0         |
| [4121:5965 · PROTO · Room — #acme-logistics (deal room)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-5965)                       | /app/views/deal-room              | Present · Day 0         |
| [4121:6086 · PROTO · Rooms — New room modal](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6086)                                   | /app/views/new-room               | Present · inactive form |
| [4121:6287 · PROTO · Intelligence Home](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6287)                                        | /app/views/intelligence-overview  | Present · Day 0         |
| [4121:6440 · PROTO · Emerging Patterns](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6440)                                        | /app/views/emerging-patterns      | Present · Day 0         |
| [4121:6554 · PROTO · Objections](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6554)                                               | /app/views/objections             | Present · Day 0         |
| [4121:6704 · PROTO · Intelligence — Team behaviors](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6704)                            | /app/views/team-behaviors         | Present · Day 0         |
| [4121:6857 · PROTO · Intelligence — Methodology adherence](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6857)                     | /app/views/methodology-adherence  | Present · Day 0         |
| [4121:6996 · PROTO · Intelligence — Outcome patterns](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-6996)                          | /app/views/outcome-patterns       | Present · Day 0         |
| [4121:7120 · PROTO · Intelligence — Rep patterns](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7120)                              | /app/views/rep-patterns           | Present · Day 0         |
| [4121:7210 · PROTO · Intelligence — Prospect patterns](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7210)                         | /app/views/prospect-patterns      | Present · Day 0         |
| [4121:7299 · PROTO · Behavior × Outcome matrix](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7299)                                | /app/views/behavior-outcome       | Present · Day 0         |
| [4121:7424 · PROTO · Team Overview](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7424)                                            | /app/views/team-overview          | Present · Day 0         |
| [4121:7549 · PROTO · Rep Comparison](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7549)                                           | /app/views/rep-comparison         | Present · Day 0         |
| [4121:7630 · PROTO · Rep Profile — Overview](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7630)                                   | /app/views/rep-profile-overview   | Present · Day 0         |
| [4121:7719 · PROTO · Rep Profile — Calls](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7719)                                      | /app/views/rep-profile-calls      | Present · Day 0         |
| [4121:7815 · PROTO · Rep Profile — Coaching](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7815)                                   | /app/views/rep-profile-coaching   | Present · Day 0         |
| [4121:7872 · PROTO · Rep Profile — Trends](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7872)                                     | /app/views/rep-profile-trends     | Present · Day 0         |
| [4121:7956 · PROTO · Team Detail — Mid-Market AE](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-7956)                              | /app/views/team-detail            | Present · Day 0         |
| [4121:8063 · PROTO · Team Detail — Reps](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8063)                                       | /app/views/team-reps              | Present · Day 0         |
| [4121:8200 · PROTO · Team Detail — Behaviors](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8200)                                  | /app/views/team-detail-behaviors  | Present · Day 0         |
| [4121:8362 · PROTO · Team Detail — Coaching](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8362)                                   | /app/views/team-coaching          | Present · Day 0         |
| [4121:8460 · PROTO · Team Detail — Calls](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8460)                                      | /app/views/team-calls             | Present · Day 0         |
| [4121:8568 · PROTO · Team Detail — Settings](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8568)                                   | /app/views/team-settings          | Present · Day 0         |
| [4121:8638 · PROTO · Reports — Index](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8638)                                          | /app/views/reports-index          | Present · Day 0         |
| [4121:8734 · PROTO · Daily Manager Brief — in-app document](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8734)                    | /app/views/daily-manager-brief    | Present · Day 0         |
| [4121:8822 · PROTO · Weekly Manager Report — living document](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8822)                  | /app/views/weekly-manager-report  | Present · Day 0         |
| [4121:8980 · PROTO · Weekly Sales Behavior Report — outline (reference style)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-8980) | /app/views/sales-behavior-report  | Present · Day 0         |
| [4121:9107 · PROTO · Weekly Rep Report — Jordan](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9107)                               | /app/views/weekly-rep-report      | Present · Day 0         |
| [4121:9149 · PROTO · Team Report — September](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9149)                                  | /app/views/team-report            | Present · Day 0         |
| [4121:9266 · PROTO · Behavior Report — Objection handling](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9266)                     | /app/views/behavior-report        | Present · Day 0         |
| [4121:9328 · PROTO · Coaching — Index (Active)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9328)                                | /app/views/coaching-active        | Present · Day 0         |
| [4121:9410 · PROTO · Coaching — Needs follow-up](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9410)                               | /app/views/coaching-follow-up     | Present · Day 0         |
| [4121:9473 · PROTO · Coaching — Completed](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9473)                                     | /app/views/coaching-completed     | Present · Day 0         |
| [4121:9581 · PROTO · Coaching Detail — Overview](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9581)                               | /app/views/coaching-overview      | Present · Day 0         |
| [4121:9658 · PROTO · Coaching Detail — Evidence](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9658)                               | /app/views/coaching-evidence      | Present · Day 0         |
| [4121:9702 · PROTO · Coaching Detail — Progress](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9702)                               | /app/views/coaching-progress      | Present · Day 0         |
| [4121:9762 · PROTO · Coaching Detail — Discussion](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9762)                             | /app/views/coaching-discussion    | Present · Day 0         |
| [4121:9817 · PROTO · Auth — Sign up](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9817)                                           | /auth/sign-up                     | Present · auth deferred |
| [4121:9863 · PROTO · Auth — Verify email](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9863)                                      | /auth/verify-email                | Present · auth deferred |
| [4121:9907 · PROTO · Auth — Forgot password](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9907)                                   | /auth/forgot-password             | Present · auth deferred |
| [4121:9946 · PROTO · Auth — Invite acceptance](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9946)                                 | /auth/invite                      | Present · auth deferred |
| [4121:9989 · PROTO · Integrations — Data sources](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-9989)                              | /app/views/integration-sources    | Present · Day 0         |
| [4121:10106 · PROTO · Integrations — Delivery channels](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10106)                       | /app/views/integration-delivery   | Present · Day 0         |
| [4121:10235 · PROTO · Integration detail — HubSpot mapping](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10235)                   | /app/views/integration-mapping    | Present · Day 0         |
| [4121:10329 · PROTO · Search — Command palette ⌘K](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10329)                            | /app/views/command-search         | Present · panel         |
| [4121:10390 · PROTO · Search — Natural-language results](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10390)                      | /app/views/search-results         | Present · Day 0         |
| [4121:10488 · PROTO · Ask Bylda — side panel (from rail ✦)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10488)                   | /app/views/ask-bylda              | Present · panel         |
| [4121:10711 · PROTO · Notifications — Drawer over Home](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10711)                       | /app/views/notification-drawer    | Present · panel         |
| [4121:10778 · PROTO · Notifications — Center](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10778)                                 | /app/views/notification-center    | Present · Day 0         |
| [4121:10890 · PROTO · Settings — Workspace general](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10890)                           | /app/settings?tab=general         | Present · existing      |
| [4121:10992 · PROTO · Settings — Profile](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-10992)                                     | /app/settings?tab=profile         | Present · existing      |
| [4121:11087 · PROTO · Settings — Users](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11087)                                       | /app/settings?tab=users           | Present · existing      |
| [4121:11232 · PROTO · Settings — Teams](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11232)                                       | /app/settings?tab=teams           | Present · existing      |
| [4121:11329 · PROTO · Settings — Roles & permissions](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11329)                         | /app/settings?tab=roles           | Present · existing      |
| [4121:11496 · PROTO · Settings — Analysis preferences](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11496)                        | /app/settings?tab=analysis        | Present · existing      |
| [4121:11603 · PROTO · Settings — Notifications](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11603)                               | /app/settings?tab=notifications   | Present · existing      |
| [4121:11778 · PROTO · Settings — Retention & privacy](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11778)                         | /app/settings?tab=privacy         | Present · existing      |
| [4121:11885 · PROTO · Settings — Billing & plan](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11885)                              | /app/settings?tab=plan            | Present · existing      |
| [4121:11995 · PROTO · Methodology — Index](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-11995)                                    | /app/views/methodology-index      | Present · Day 0         |
| [4121:12113 · PROTO · Methodology — Detail (stages)](https://www.figma.com/design/HWdVvVXWqJl4BFD9MZ5vgW?node-id=4121-12113)                          | /app/views/methodology-detail     | Present · Day 0         |
