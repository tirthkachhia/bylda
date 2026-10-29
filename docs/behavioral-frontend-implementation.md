# Behavioral frontend: local implementation

> Superseded by the [Figma-only MVP implementation and Theo handoff](figma-mvp-handoff.md).
> The mixed-design state and remaining gaps below describe the earlier audit, not the current UI.

Status: both implementation segments are integrated locally on
`feat/behavioral-figma-integration`. Nothing has been pushed or deployed. `main`
remains at `1760fb78477444e25ab1759690d277fec915b7eb`. No backend functions,
migrations, analyzer rules, or generated database types changed.

## Implemented sections

The subsequent [design and wiring audit](behavioral-frontend-audit.md) identifies
remaining gaps and corrects the earlier classification of the manager-held action.
Use that audit before deciding this scope is finished or ready to merge.

| Section                | Implementation                                                                                                             | Existing data consumed / limits                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared foundation      | `src/lib/coaching/{types,behavior,source-navigation}.ts`                                                                   | Backend analysis types; paginated runs, events and reviewer feedback; exact organization/call/rep/run identity; retained source snapshots. Missing sources fail visibly rather than opening another transcript.                                                                                                                                          |
| Workspace shell        | `src/components/app/LiveWorkspaceShell.tsx`, `src/lib/workspace-navigation.ts`, `src/styles/{bylda,revenue-workspace}.css` | Figma light rail/sidebar/header, Inter typography, local Figma assets, search/upload navigation and mobile menu. Existing authentication, sign-out and legacy tools remain connected.                                                                                                                                                                    |
| Ingestion              | `src/components/app/coaching/{BulkCallUpload,UploadRows,RepPicker}.tsx`                                                    | Existing upload → import → analysis pipeline; real rep selection; per-file status, consent and 100 MB validation. No new ingestion endpoint.                                                                                                                                                                                                             |
| Calls                  | `src/routes/app.crm.calls.tsx`, `src/components/app/coaching/CallList.tsx`, `src/lib/coaching/{calls,calls-search}.ts`     | Organization-scoped 50-call pages, rep/date filters, hydrated CRM context, exact source lookup, processing refresh. Search/stage/analysis/family filtering explicitly applies to loaded calls.                                                                                                                                                           |
| Call review            | `src/components/app/coaching/{CallDetail,BehaviorInsights}.tsx`                                                            | Moment → context → rep behavior → buyer reaction → observed progression → interpretation; independent qualitative dimensions, evidence quotes, confidence, alternatives, coverage, playbook version and reviewer feedback. Scores remain available under Diagnostics.                                                                                    |
| Playback               | `src/components/app/coaching/CallRecording.tsx`                                                                            | Signed stored audio or HTTPS provider reference; metadata-aware seeking, scrubber, speed and skip controls; transcript fallback. Unknown timestamps remain unknown; zero is valid.                                                                                                                                                                       |
| Manager home           | `src/components/app/TodayBrief.tsx`, manager-home queries in `src/lib/queries.ts`                                          | Actual recent analyses, calls, reps and reports; exact workspace imported/analyzed totals. No synthetic team-performance series.                                                                                                                                                                                                                         |
| Rep profile / insights | `src/components/app/coaching/BehaviorManagerBrief.tsx`                                                                     | Three retained event families, source-backed examples and existing guarded per-rep comparisons. Incorrect findings are excluded; low-confidence actions and untrusted comparisons are withheld. Counts describe selected opportunities, not exhaustive call rates.                                                                                       |
| Coaching reports       | `src/components/app/coaching/RepReportPanel.tsx`, report queries in `src/lib/queries.ts`                                   | Existing report generation, complete history, period, strengths, patterns, practice drill and legacy citations; running/failed/missing states. A report citation opens the call with a notice when it lacks an immutable run identity. The basic manager-held action currently needs restoration; the backend supports that attestation (see the audit). |
| Methodology            | `src/components/app/coaching/{PlaybooksPanel,GuidelinesList}.tsx`                                                          | Existing playbook creation/editing, immutable saved versions, version restore/archive and guideline extraction/filtering. Assignment remains the existing rep-level playbook action; old call runs retain their own versions.                                                                                                                            |

Figma references inspected: file `HWdVvVXWqJl4BFD9MZ5vgW`, Manager Home
`4121:2508`, Rep Report `4121:9107`, Methodology index/detail
`4121:11995` / `4121:12113`, Calls `4121:4297`, Call Review
`4121:173`, Overview `4121:3779`, Analysis `4121:3897`.

The implemented screens follow these layouts and assets while displaying only
supported data. This is not a claim that every Figma workflow is backed by the
current backend.

## Data constraints preserved

- Playbook execution, sales effectiveness, rep behavior, buyer state, progression
  and risk/review remain separate qualitative judgments. Transcript observations
  do not become verified commercial outcomes or compliance verdicts.
- Discovery/recommendation, objection clarification/resolution, commitment/next
  step findings, strengths and adaptive behavior use retained events and evidence.
  Partial resolution and uncertainty remain visible.
- Source turn IDs belong to an analysis run. Behavioral links retain run, event
  and turn identity. Legacy reports lack this identity; their exchange indices
  are not converted into source turn IDs. Re-analysis does not repair old report
  provenance retroactively.
- Coverage reports available transcript turns and whether the ending was analyzed.
  It cannot verify that the uploaded recording represents the entire real call.
- Recurring examples and trends are per rep. The existing comparison gates need
  matching model/prompt/taxonomy/objective/stage/buyer constraints, and sufficient
  accurately reviewed opportunities across multiple calls in both periods.
  Insufficient evidence is displayed rather than a made-up trend.

These Figma elements stay hidden/inactive because their necessary contracts are
absent: measured WPM/pauses/interruptions/questions/monologues; sentiment/control
curves or buyer-cooling scores; team baselines and pattern lifecycle; coaching
assignment/acknowledgement/check-in lifecycle; rep self-service login; saved
view/review-seen persistence; rooms/messages/shared clips and report delivery
through email or Slack. No substitute analytics or sample customer data ship in
these screens.

## Local branches and later merge

1. `feat/behavioral-frontend-foundation` — `3615ce9`.
2. `feat/manager-intelligence-figma` — `2e0ea16`, based on the foundation.
3. `feat/call-review-figma` — `98c0de7`, based on the same foundation.
4. `feat/behavioral-figma-integration` — local manager merge `a6c49d5`, then call
   merge `894d67d`, followed by shell/style/navigation and combined QA corrections.

This preserves the two file-ownership segments without merging foundation or
features into `main` early. The integration branch already contains both feature
branches. When reviewed and authorized to push, a PR from integration to `main`
can carry the complete result; it does not require merging the same feature
branches again. No push or PR creation is part of this local-only pass.

## Validation

- TypeScript check passes.
- ESLint passes for changed TypeScript/TSX files.
- All **414 tests across 54 files** pass, including source identity, pagination,
  timestamps, report citations, reviewer/uncertainty gates, call review, upload,
  playback, backend behavioral regression and storage tests.
- Production client/server build passes.
- Browser QA at 1440×1080 and 390×844 covers Home, Calls, Call Review, rep profile,
  Trends, report-to-call links, methodology guidelines/versions and mobile menu.
- Browser QA covers empty and error states, missing report/run identity,
  history without events, upload file validation and consent. Local audio
  seeking and speed controls are checked with a real media element.
- All visible downloaded assets load at their intended slots; Figma card radius
  is 12 px. Mobile call review has no document horizontal overflow. No browser
  page errors were observed.

Visual QA uses an isolated temporary Vite entry, an in-memory Supabase-compatible
fixture and a synthetic WAV outside this repository. These verify rendering and
interaction, not live backend availability. Production authentication and queries
are unchanged; the temporary preview is not a production build or mock mode.

Before merging/releasing, real authenticated workspace acceptance still needs to
exercise deployed migrations/RLS, a real media import and analysis, signed audio,
reviewer writes, report generation and playbook save/restore permissions. No live
customer writes or production deployment were performed here.

Standard verification with the locked runtime/dependencies:

```sh
bun install --frozen-lockfile
bunx tsc --noEmit
bun run test --maxWorkers=2 --minWorkers=1
bun run build
```
