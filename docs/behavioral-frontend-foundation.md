# Behavioral frontend foundation

Branch: `feat/behavioral-frontend-foundation`  
Base: `1760fb78477444e25ab1759690d277fec915b7eb`

Merge this foundation before creating `feat/call-review-figma` and
`feat/manager-intelligence-figma` from the same updated `main`. Do not merge either
implementation into this branch. No screens, backend algorithms, migrations, or
generated files are changed here.

## Shared contracts (owner: call-review developer)

- `src/lib/coaching/types.ts` reuses the backend analysis/event/evidence contracts.
  `BehaviorRow.assessment` omits the three evidence arrays because storage keeps
  them in `BehaviorRow.evidence`. `end_s` belongs to the row. `BehaviorRun` is the
  lightweight history projection; `BehaviorRunSource` additionally carries source
  snapshot, transcript hash, organization, and playbook version identity.
- `src/lib/coaching/behavior.ts` keeps existing type exports and reader signatures
  compatible. History and event readers accept an optional organization ID;
  new consumers should pass it. Run/event IDs plus server RLS still scope older
  callers. All history/event/feedback pages are read; IDs are batched for bounded
  requests. A failed page rejects the complete query instead of returning partial
  counts. Stable secondary ID ordering breaks timestamp ties. History retains the
  latest run per call after pagination, not after a capped first page.
- `behaviorQueryKeys` exports the event, feedback, history, and source prefixes.
  Feedback IDs are deduplicated and sorted for consistent cache keys. Existing
  invalidation with `["behavior-feedback"]` remains valid. A successful review
  should invalidate that prefix; consumers recompute their display from refreshed
  feedback. No comparison thresholds or review eligibility rules change here.
- `behaviorRunSourceQuery(target)` selects only the requested run under the exact
  organization/call/rep scope, including explicitly unassigned reps. It does not
  fetch the latest run when that source is missing. A missing row returns null;
  a query/permission error rejects. Source snapshot queries have separate keys
  from history and do not add source payloads to the manager brief.

## Navigation and playback

Import `CallSourceTarget`, `OpenCallSource`, and `SourceNavigationProps` from
`src/lib/coaching/source-navigation.ts`.

Every target includes organization ID, nullable rep ID, call ID, nullable seconds,
and a discriminated source:

- `behavior`: required run ID, optional source turn ID and event ID.
- `report`: required report ID and optional legacy exchange index.
- `call`: no historical source identity asserted.

`parseCallSourceTarget` validates external inputs without turning absent, invalid,
or string-valued times into zero. A turn ID is a nonnegative integer local to a
retained run's snapshot. Legacy report exchange indices can be negative; they
are never translated into source turn IDs or invented run identities.

`resolveBehaviorSource` reconstructs source turns using the same existing pure
`sourceTurns` helper as the analyzer. It accepts only the matching retained run,
highlights the requested turn, and uses that turn's source time (including null).
It returns an explicit unavailable reason for missing/mismatched runs, snapshots,
or turns. It never accepts the current transcript as an implicit substitute.
An event ID is a locator for the call-review implementation to validate against
the requested run's event rows; the source resolver itself resolves turns only.

`requestCallSource` uses `onOpenSource` when supplied. Without that handler,
behavioral snapshot navigation returns unavailable; it cannot silently degrade to
the old callback. Call and legacy report targets may use `onOpenCall(callId,
seconds?)`. A rejected richer handler never falls back to another target.
The returned `requested` state means dispatch completed, not that playback or
navigation was independently verified. Callers handle callback errors visibly.

`playbackSeekSeconds` validates times and clamps to loaded media duration. It is
for use after metadata loads. Missing/invalid time remains null, zero remains
valid, and zero-duration media is unavailable. Audio absence/failure falls back
to transcript evidence; a known turn with unknown time can still be highlighted.
Signed recording URLs stay transient. No precise behavioral timing is inferred.

## Component compatibility

`BehaviorManagerBriefProps` and `RepReportPanelProps` share the existing required
`onOpenCall` callback and declare optional `onOpenSource`. The foundation only
changes their types, not their rendered output or navigation behavior. Mayur
will consume/pass the optional handler in his branch; the call-review developer
will supply the real resolver in the calls route. Declaring an optional prop is
not a claim that snapshot navigation is already wired in those screens.

## Parallel implementation ownership

**Call-review developer:** calls route, call hydration/list/detail, behavioral
evidence/review, scores, upload, recording/playback, shared contracts, shell,
navigation, shared primitives/styles, final generated files.

**Mayur:** `BehaviorManagerBrief`, `RepReportPanel`, `PlaybooksPanel`,
`GuidelinesList`, `RepPicker`, `app.index`, `TodayBrief`, necessary components
under `coaching/manager/`, and rep/playbook/report queries in `src/lib/queries.ts`.
Preserve unrelated and call-scoring query exports in that shared module.

After this branch merges, the two manager component files touched for type
compatibility return exclusively to Mayur. He requests shared-contract changes
rather than independently editing them. Neither branch changes backend helper
algorithms. `app.playbook.tsx` and `app.bylda.reports.tsx` are unrelated existing
surfaces, not sales methodology/behavior-report implementations.

Merge order: foundation -> Mayur -> rebased call-review branch -> optional small
integration branch. Keep old component callers working so Mayur can merge first.
Do not expose a snapshot-specific link until its richer handler is supplied.

## Remaining exclusions

Do not invent WPM, pauses, interruption counts, sentiment/control curves, buyer
cooling scores, verified outcomes, or compliance verdicts. Do not implement
unsupported team analytics, coaching assignments/results, delivery, clip sharing,
saved-view persistence, or rep login by projecting unrelated existing fields.
Coverage describes available transcript turns, not verified recording completeness.
The current upload contract remains media files up to 100 MB.

## Validation

Run with the repository's locked dependencies:

```sh
bun install --frozen-lockfile
bunx tsc --noEmit
bun run test --maxWorkers=2 --minWorkers=1
bun run build
```

New tests cover exact source/snapshot identity, unavailable sources, zero/unknown
times, legacy report indices, non-fallback dispatch, event/history pagination,
latest-run selection, ID batching, scoped source queries, and later-page failures.
Existing behavioral, trend, report, storage, and playback regressions must pass.
Live database deployment/RLS and real recording playback require integration QA;
mocked query tests do not establish production availability.

Verified for this foundation: TypeScript check, production build, changed-file
ESLint, and all 389 tests across 50 test files pass (including 33 new foundation
tests). No live database or recording acceptance test was performed.
