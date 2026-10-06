# Lane 5 — Section 1: Integrations

Implemented X1 Data sources, X2 Delivery channels, and X3 HubSpot mapping.

Design reference: copied Figma file `rOK5GQ1TzyTuHmyXiOALrD`, frames
`31:1464`, `31:1688`, `31:1915`; read Foundations `3:2` and Dev Handoff `21:2`.
Checked rendered screenshots at 1440px, using each frame’s height (X1 1156,
X2/X3 1080). Screenshots: `design-qa/X1.png`, `X2.png`, `X3.png`.

The implementation uses the existing semantic tokens, UI kit, shell context
slot, and data hooks. Both routing switch SVGs are the actual Figma assets,
downloaded locally and verified at their intrinsic 32 × 18 size. Integration
status tags follow the source frames, consistent with the existing Y8 state.
The inherited shell differs from the mockup in top-bar breadcrumb wording,
context-panel vertical origin, and current viewer identity. Its frozen files
were not altered. Table overflow scrolls rather than hiding inaccessible fields.

Missing presentation fields are isolated in `demo.ts` and appear only with
`VITE_BYLDA_MOCKS=true`. Live mode renders the supplied source/mapping values
and honest unavailable messages for missing totals, routing, and previews.
Shared contract gaps are recorded in LANE_REQUESTS #13.

Connect/reconnect uses the existing data mutation. Other actions without a
shared mutation explain that they are unavailable; routing changes are labeled
as an unsaved preview. No CRM write, disconnect, sync, or configuration mutation
was invented. Connections are restricted to owner/admin roles.

## Verification

- Production build: passed.
- Changed-file lint and token gate: passed.
- Backend boundary: passed (15 guarded patterns); no backend files changed.
- Typecheck: exactly the 8 documented pre-existing errors, none in Lane 5.
- Tests: 370 passed, 36 skipped, only the 2 documented integrations-catalog failures.
- Three new safety tests prevent fixture data from leaking into live sources/mappings.
- Browser: all three screens render without errors or document overflow.
- Browser interaction checks: source → mapping navigation, routing switch state
  and preview notice, reconnect demo feedback, disconnect unavailable notice,
  and rep denial on all three routes passed.
- Routing asset geometry and successful image loading checked in the browser.
- Empty/loading/error states use the existing DataBoundary and SystemState UI.

This Mac ships Bash 3, while the repo scripts use `mapfile`; the original guards
were run through a temporary local compatibility function. No shared scripts or
runtime/dependency files were changed.
