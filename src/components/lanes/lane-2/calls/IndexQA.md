# Calls index and rep view — C1 / C2 / C9

Base: integration `000a5a6d01ee1aee58673e1e720f10ee9ad23cf8`. Separate clone; `origin/lane-2-mayur` (`bac2043`) was already an ancestor of integration, with no lane-only commits. Sync was a fast-forward; existing Call Review C3–C6 is unchanged.

Saved references: C1/C2/C9 spec.md and frame.png, \_tokens.md, \_foundations and relevant page-02 components. CLAUDE.md and data-layer README supply handoff rules. No live Figma tools used. Thin routes and export names preserved.

## Behavior

C1/C2 use useCalls and useSavedViews; C9 and reps arriving at either manager index use useMyCalls. Before rendering own rows, filter again by the loaded viewer ID. No peer links, saved-view counts or manager filters mount in the rep view. Missing call evidence metadata is withheld, so no unsupported insight or low-confidence action appears. Shared values are never overridden.

Local account/contact search, date, rep, outcome, type, methodology stage and duration filters compose; multi-select groups allow toggling; Clear all clears the active saved selection and every filter. Sorting uses shared coaching value descending (nulls last, date tie-break) or newest date. Counts explicitly refer to loaded calls. Saved views apply supported explicit filter fields, preserve the supplied count, and reject unsupported team scope. Save as view reports an unsaved session draft. Behavior/review-status/transcript search, sharing and behavioral summaries disclose unavailable contracts. Filters reset on route remount/reload; no persistence is claimed.

C9 shows actual moment timestamps and own call status. Last-30-day loaded call count and median duration are computed from own shared calls, independent of Won/Lost tab selection. Other metrics and self-comparison are unavailable. No peer sharing exception. Loading, empty, filtered-empty, retryable error and forbidden boundaries are implemented.

Existing #34 field/select/table primitives are reused from Lane 5; Lane 2 adds only pill filter choices (#54). Branding stays in the frozen shell via kit Wordmark. No backend, kit, data, styles, shell, router config, dependencies or env files changed.

## Visual review

Native captures: `design-qa/C1.png`, `C2.png`, `C9.png`, 1440×1080. Compared visually with all saved frames; one correction round compacted search and reduced per-row wrapping. No page overflow. Remaining differences are explicit in LANE_REQUESTS #52–#55: source data/ownership, fewer rows, unsupported fields/actions, truthful neutral tags, complete names, extra functional toolbar and contract notices, frozen shell differences. C2 main content starts lower than its frame because local search/sort controls remain visible. C9 sharing card is higher because only two shared own calls exist. This is not an exact pixel match; no design data was fabricated to fill it.

## Verification

- Focused run: 39 passed across call-index, shared rep-safety and shared insight-threshold tests. Call-index tests: 11 passed (scope, unmodified shared values/order, combined filters, null sorting/median, loading/error/empty boundaries, missing evidence, own links, supported saved status, unavailable team scope and draft feedback).
- Browser with `VITE_BYLDA_MOCKS=true`: C1/C2/C9 captured; search/matching-empty/reset, saved status, outcome filtering, unsaved feedback; manager/rep/owner on all three routes; own deep link opens; rep peer deep links for call_kestrel/call_vela/call_ferro show permission denied. No browser page errors or page overflow.
- Full suite: 530 passed, 36 skipped, 2 failed; 78 test files passed and 1 failed. Both failures are the existing integrations-catalog ReadyMode availability and multi-credential fallback tests.
- Typecheck: exactly 8 errors, all outside lane folders (ConnectSources 4; use-operator-data 1; app.context-memory 1; sales-verticals 2).
- Changed-file lint: clean (6 TS/TSX files). Tokens: clean (62 legacy files baselined). Backend boundary: clean (15 patterns, 11 changed files). Production build: exit 0. All checked before push.

No merge authorized. Stop for review after the single PR into integration.
