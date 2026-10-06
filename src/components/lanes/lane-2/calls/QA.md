# Lane 2 — Section 1: Call Review

C4 Overview, C3 Transcript/timeline, C5 Analysis and C6 Coaching use the repository's `design-ref/<code>/spec.md` and `frame.png`. No Figma MCP calls. The Figma design-to-code workflow informed component reuse, native asset geometry and screenshot comparison; the repository's saved references replace live design retrieval.

## Data and boundaries

- Shared demo call `call_acme` is consumed without overriding title, contact, stage, outcome, summary, transcript, moments, duration, talk ratio, detected event counts, methodology, next steps, coaching focus or evidence.
- Request #26 records the design's Negotiation stage and empty next step for Mayur to fix in shared data. The current shared stage and next step deliberately remain visible, so screenshots are not claimed pixel-identical in content.
- Only absent qualitative objection/pacing presentation and coach-note fields have typed forced-demo supplements. They do not appear for real calls, other demo calls, processing or failed calls. Rep views omit peer comparisons. Derived metrics with unavailable confidence are marked low confidence, with no suggested action.
- Missing contracts/actions are request #27. Note drafts are explicitly not persisted. Room sharing does not post anything. Recording playback requires a real recording URL; otherwise it explains that no recording is available. Reanalysis and coaching assignment use existing public hooks.
- No backend, environment, dependency, router, navigation, shared data or shared UI changes.

## Visual comparison

Screenshots at 1440px: `design-qa/C3.png`, `C4.png`, `C5.png`, `C6.png`.

Typography, semantic colors, tabs, panel treatment, spacing, transcript/search, player controls, two-column analysis and coaching context follow saved designs. Native waveform SVGs keep their exported dimensions. Shared detected events are shown rather than replacing them with design-only timeline values. Continuous control/sentiment tracks are still a shared-contract gap. Confidence/sample labels add space required by product rules. The inherited shell/context offset and breadcrumb differences are request #28. Missing opportunity/extra contact fields are omitted, not fabricated.

## Verification

Browser checks cover all four manager screens, tabs, seek controls, unavailable recording feedback, transcript search/no-match, local note preview/reload, rep ownership/peer-call denial, static asset loading, overflow and browser errors. Automated tests cover loading/error/empty, processing/failed, rep restrictions, real-data isolation and forced-demo shared-data preservation.

Final validation results are recorded in the PR. Baseline allows exactly eight existing type errors and two existing integrations-catalog test failures; these unrelated files are unchanged.

Section 1 only. Stop after opening its PR; do not start Section 2 before this PR is merged.
