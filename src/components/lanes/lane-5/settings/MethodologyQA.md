# Methodology E9–E14 — 2026-10-02

Built from each saved `design-ref/<code>/spec.md` and `frame.png`; no Figma tools.
Native Chrome ran the existing Vite server with `VITE_BYLDA_MOCKS=true` at port 8082.
Owner role, 1440×1080; E10 and E12 use their native 1440×1156 frame dimensions.
Final screenshots: `design-qa/E9.png` through `E14.png`. Browser captures were JPEG,
converted to PNG with sips; compression limits pixel-level comparison.

Compared all six initial screenshots with saved frames and made **one visual correction round**:

- Template pills; fixed table column proportions.
- E11 methodology selector and removal of extra tabs to match its header/table structure.
- E10 stage editor offset; E12 definition field height, rule panel and settings-row spacing.
- E14 header and good-call row spacing.

## Remaining differences (not FIGMA MATCH)

- Frozen shell: Settings-prefixed breadcrumb, Mid-Market AE · 9 reps workspace subtitle,
  icons/Home rail state and role-specific DM/room content differ from saved frames.
- §13 governs: neutral status tags/notes and 6px controls/10px cards replace functional
  signal decoration and inconsistent saved radii.
- E9: shared data supplies MEDDIC — Mid-Market (one methodology/four behaviors), rather
  than three methodology rows. No edit metadata or teams. MEDDIC template wraps;
  templates/scope note appear higher because fewer shared rows. MEDDPICC creation isn't available.
- E10: five actual stages, empty exit-criteria lists; no descriptions, detection rules or
  stage-specific behavior mapping. Editor shows unavailable values rather than fictional
  stage toggles. Its lower section is shorter than the reference.
- E11: four actual behaviors rather than ten saved rows. Detector source/rep visibility
  unavailable. Long behavior and direction labels wrap, making rows taller; enabled
  switches are actual shared flags and editable drafts.
- E12: actual interruption/objection rule and definition differ from the saved threshold
  builder. Custom logic stays read only/LATER. Stages/rep visibility and all test results
  unavailable. No fabricated sample, agreement percentage or matched-call evidence.
  Lower sections are about 30px below the saved frame after the correction round.
- E13: two actual objections with category sublines and longer responses, no example
  phrases or suggestions. Counts 23/6 have no period, so header says SEEN. No invented
  47 unclassified or behavioral suggestion from three calls. Table/note are shorter.
- E14: good-call controls unavailable; no invented thresholds. Sources are Call/CRM,
  windows/weights unavailable. Extra ON column exposes actual enabled flags as drafts;
  table/note sit about 20px lower. No unsubstantiated week-two outcome claim.

## Validation

- Typecheck: exactly eight documented baseline errors, none in Lane 5.
- lint:changed, tokens:check, boundary and production build pass.
- Full suite: 448 passed, 36 skipped, two known integrations-catalog failures (486 total).
- Lane 5 settings suite: 16 passed, including nine new scope/access/state tests.
- Browser: stage rename/save disclosure, keyboard behavior toggle, owner links preserve
  demo role, rule definition/direction drafts, test/save disclosure, objection edit/add/cancel,
  success outcome toggle and reload reset verified. Invalid methodology/rule IDs render
  not-found states; rep route access renders permission denied before controls.

Saving, template creation, duplication and rule testing have no hook contracts.
Drafts never mutate shared query data. Requests #40–#42 document kit/data/design gaps.
The switch/draft helper is identical to pending PR #33; this section uses its own branch
from integration so E6–E8 remains a separate PR.
