# Lane 6 · Section 1 · Reports · draft

Branch: `lane-6-mayur`, synced with `origin/integration` (`5580b00`, including merged auth PR #13). Only P1, P2 and P5 are in scope. Section 2 is untouched.

## Implemented

- P1 report index uses `useReports` and `useViewer`: derived counts, category filters, selected-report ID navigation and explicit empty states. No inferred shared reports or delivery channels beyond this in-app view. Unknown status/subject metadata stays unavailable.
- P2/P5 use `useBrief` unchanged. Shared InsightCard, EvidenceBlock and DataBoundary handle confidence/sample size, evidence links, loading, error and empty states. Below-threshold statements are suppressed; low confidence has no action. Narrative without statement confidence/sample size is withheld under CLAUDE.md §13.14.
- Daily contents links and weekly disclosures work. Reps cannot render manager briefs, even through direct URLs. Rep index relies on the role-scoped shared hook and additionally excludes manager/team kinds.
- Share copies the current URL, without changing access. Scheduling, pinning and PDF export explain that no action occurred. Comment drafts are explicitly local, unsaved and unposted.
- Backend, frozen foundation, shared mocks, router configuration and dependencies are unchanged. No lane-local data overrides.

## Saved-design comparison — not a full match yet

Compared `design-qa/P1.png`, `P2.png`, `P5.png` against each saved `design-ref/<code>/frame.png` and spec at native 1440-wide sizes (1080/1656/2056 tall). The Figma design-to-code skill guided token/component reuse and native layout verification; no live Figma access was used.

| Screen | Layout implemented | Open differences |
| --- | --- | --- |
| P1 | Content inset x=348, editorial header, category row, hairline table, shared shell | Only three shared reports, rather than six pictured rows or the design's tab totals. No report subtitle, delivery/status/sharing or subject presentation contract. Row heights vary with real content. |
| P2 | Toolbar, document x=432/680px, contents x=1172/220px, editorial section headings, evidence/action cards | Shared brief has two sections rather than six designed sections. No short-version narrative, coaching rows, changes, full review queue, coverage or comment data. Shared period/read time differ. |
| P5 | Document x=432/608px, weekly disclosures, contents column x=1160/280px | Shared brief contains daily-style two sections, not the designed weekly executive summary, changes, behavior table/sparklines, rep changes, coaching priorities, recommendations and comments. Contents panel starts below the inherited top bar rather than frame y=0; shared shell cannot be changed by this lane. |

Do not invent totals, comments, series, coaching results or report statements to fill these gaps. Do not copy low-sample design claims: §13 thresholds override Figma. Missing data/actions are the three Mayur / Lane 6 requests in `LANE_REQUESTS.md`. This PR remains draft; it does **not** meet the full visual definition of done and must not be merged as a completed Section 1.

## Verification

- Nine Lane 6 tests pass: selection, categories, role safety, evidence thresholds, loading/error/empty, low confidence/no action, narrative qualification and wrong-format handling.
- Browser checks pass: tab filtering; actual report ID preserved; unsupported actions disclose no write; local comment draft; Share notice; weekly collapse/contents reopening; unknown ID; rep-only index and denied manager URLs; 1024px no document overflow; no page errors.
- Changed-file lint, token check, backend-boundary check and production build pass.
- Typecheck remains at the documented eight unrelated baseline errors, with no Lane 6 errors.
- Full suite: 394 passed, 36 skipped, two existing integration-catalog failures (ReadyMode and GoHighLevel credential fields), outside lane scope. No fixes attempted in frozen/backend files.

Before ready-for-review: resolve shared report contracts/content through the owner, render the full P1/P2/P5 designs with statement evidence metadata, repeat native screenshot comparison and validation. Do not begin Section 2 before this section is reviewed and merged.
