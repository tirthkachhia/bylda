# Lane 6 section 2 — report detail QA

Review correction (2026-10-03): statement guards now reject missing/null/unknown confidence, non-finite analyzed-call counts, plural outcome/win-rate claims (including sample-label claims), and causal statements without an explicit boolean `true` flag. Personal report headlines reject plural peers/rankings/other-rep comparisons. Two regression tests exercise these inputs and verify all four rendered report detail components omit rejected statements, evidence and recommendations. Scoped section suite: 26 passing tests. These conservative text checks do not establish typed closed-outcome evidence or backend authorization; requests #65–#68 remain open and the PR remains draft.

Mayur · 2026-10-02 · integration base `38e065c3a42088f103d6920c52ae7685acfbe9e2`.

This is a partial frontend implementation for review, not complete report functionality or a pixel match. Shared-contract requests #65–#68 remain open. P1/P2/P5 and their helpers are unchanged. No shared data, backend, kit, styles, shell, routes, nav, router, dependencies or reference exports were changed.

## Saved-reference comparison

Read design-ref/P7, P8, P9 and P6 specs and inspected their frame.png files; used saved Foundations/tokens and CLAUDE §4/§13 handoff rules. There is no standalone Dev Handoff export in the saved reference index; no live Figma tools were called.

Final captures are 1440×1080: design-qa/P7.png, P8.png, P9.png and P6.png (manager), plus corresponding *-rep.png captures (own P7 and denied P8/P9/P6). References P7/P8 extend to 1256px, P9 to 1156px, P6 to 1080px; captures compare the desktop viewport, not the entire longer reference canvas.

| Screen | Retained structure | Remaining differences |
| --- | --- | --- |
| P7 | 160px desktop inset, three metrics, focus panel, statements/evidence, footer actions | Shared title/period are Weekly Rep Report — Jordan / Wk 39, generated Sep29, 5-min read rather than greeting/Sep21–27/14 calls. Metrics, report focus and check-in unavailable. One qualified Jordan statement and one verified call_acme quote replace the design narrative and three moments. Body's top-performer comparison, team outcome pattern and Theo clip withheld. Kit confidence/sample and unavailable notes add height; focus uses a raised outer panel around the inset rows. |
| P8 | 36px inset, five metrics, two panels, by-rep table | No team brief exists. Neutral title/period unavailable notice replaces September narrative. Five individual missing-measurement cards replace the continuous KPI strip. No fabricated trajectory/coaching results/rep rows; panels and empty table have different heights. No shared current data substituted for report-period measurements. |
| P9 | 36px inset, two sequence cards, analysis table, evidence area | No behavior brief exists. Generic title and missing report replace the design's headline/90-day association. Strong/weak descriptions, rates, names and two clips unavailable. One missing-evidence note replaces clips; no outcome percentages or closed-sample claims. |
| P6 | 64px inset, 700px document + 300px contents, ten expandable sections, four summary tiles | Shared Wk39/5-min/generated metadata replaces Sep21–27/team/call coverage. Summary/metrics and mini charts unavailable; collaborators/comments absent and Share disabled. Added supplied-statements panel after the outline rather than pretending daily-style shared sections map to the summary. Contents starts under frozen full-width topbar rather than occupying its right side. Notice/spacing increases vertical extent; Evidence and supplied statements are below the first viewport. |

Frozen shell differences include breadcrumbs, icon variants, sidebar content and role subtitles. Rep shell correctly hides manager/peer surfaces. No gradient, simulated chart, projection, invented numbers/narratives or persistence was added.

## Access and evidence behavior

- Manager/owner/admin can mount these reports; other roles are denied except reps can mount their own P7. Reps are gated before useBrief runs. No missing or peer rep parameter is rewritten to the viewer.
- Route subject must equal returned Brief.subjectId and the kind must match the screen. Selected reportId cannot bypass format/subject checks. Latest-by-kind is not a subject lookup; unmatched reports fail closed.
- P7 statements must name exactly the selected rep in affectedRepIds and cannot be team patterns/ranking headlines. Additional body/sample-label text is withheld because those fields lack personal-only scope. Evidence requires a matching call ID and repId from public useCalls; unknown and peer evidence is dropped.
- Statements use public rep/team analyzed-call thresholds, finite positive samples and the kit confidence display. Low confidence has no actions. Narrative without quality metadata is withheld. Closed-outcome and unsupported causal claims recognized in text are withheld; this conservative text check is not a substitute for typed outcome/scope contracts. Brief has no n_closed linkage, so no OutcomeAssociation is rendered or inferred from sampleSize.
- Share, PDF and team-focus actions remain disabled; no report save, delivery, comment or persistence claim. Native P6 disclosures and contents anchors work; own P7 evidence links to the call transcript timestamp.

## Verification

All app/tests/build checks used VITE_BYLDA_MOCKS=true. Locked dependencies installed with Bun; no lockfile changes. macOS Bash 3 lacks mapfile, so an untracked work/ compatibility wrapper supplied mapfile and local Bun-backed npx for the unchanged guard scripts. Dev server required an unsandboxed local listener and polling; no Vite configuration changes.

| Check | Exact result |
| --- | --- |
| Untouched integration baseline, bun run test | 640 passed, 36 skipped, 2 known failures; 86 passed test files, 1 failed |
| Scoped new section + existing reports tests | 33 passed in 3 files (24 new tests + 9 existing report tests) |
| Final bun run test | 664 passed, 36 skipped, 2 known failures; 87 passed test files, 1 failed |
| bun run typecheck | Exit 2, exactly 8 existing errors; zero report errors |
| bun run lint:changed | Exit 0, 7 changed TS/TSX files; max-warnings=0 |
| bun run tokens:check | Exit 0; no new raw colors |
| bun run boundary | Exit 0; no backend paths touched |
| VITE_BYLDA_MOCKS=true bun run build | Exit 0; client + SSR + Nitro/Vercel output produced |
| Real-browser checks | 16 successful checks, zero page errors |
| git diff --check | Clean |

Known failures are integrations-catalog: ReadyMode popular listing and multi-credential fallback. The eight type errors remain in ConnectSources.tsx (4), use-operator-data.ts (1), app.context-memory.tsx (1), sales-verticals.ts (2). Build retains existing large-chunk and environment/deployment warnings. None was changed.

Browser matrix: all four as manager and rep; rep own P7 contains no top-performer/team outcome/peer content, other three denied; rep u_alex route denied; manager mismatched rep subject and four cross-format reportId routes rejected. P6 contents opens Recommendations and its native disclosure closes; P7 own evidence reaches /app/calls/call_acme/transcript#t-1122. Unit tests independently exercise every screen's loading/error/missing/forbidden state, viewer loading, missing/peer route parameters, call evidence loading/error/ownership, thresholds, sample validity, causal/outcome withholding and low-confidence action suppression.

One section, one PR into integration. Stop for review; do not merge or begin the next section.
