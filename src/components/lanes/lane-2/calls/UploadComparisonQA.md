# Lane 2 — Upload + comparison (C7/C8)

Built from saved design-ref specs and frames, with shared hooks and kit only. Existing #34 field/select/table primitives reused; no new primitive. No shared/backend/data/shell/nav/router/dependency/env changes. Requests #56–57 describe absent contracts.

C7 selects actual local files with picker/drop, checks the service's accepted extensions/maxBytes (including uppercase, empty and oversized files), and removes selections. It never transfers bytes, claims upload success or invents jobs. Retry handles failed policy loading. Rep/account/type/speaker assignment are explicitly unavailable. Thus the saved frame's five fabricated job rows are replaced by an honest empty state until local selection.

C8 selects two accessible calls, swaps them and opens full transcripts. Rep choices and responses are ownership-checked; stale IDs and duplicate choices are rejected. Each raw transcript uses its own first detected objection timestamp; absent anchors use absolute time. Matching objections and aligned behavior metrics are not inferred. Whole-call differences are withheld because they lack window/confidence/sample metadata. No sharing or peer exceptions.

1440×1080 screenshots: design-qa/C7.png (empty local selection), C8.png (shared Acme/Brightline pair). Visually compared with references. Remaining deviations are honest missing data/actions, selectors, metadata/content and neutral outcome tags; shared shell differences remain outside scope. Not pixel-identical. No Figma tools used.

Validation: 9 new section tests + 20 shared rep-safety tests pass. Full suite: 539 passed, 36 skipped, only the two known integrations-catalog failures. Typecheck: 8 existing errors outside Lane 2. Scoped lint, tokens, boundary and production build pass. Browser details recorded after final QA.

Browser: manager and rep C7 empty selection/assignment-unavailable views; C8 raw Acme/Brightline transcripts, swap, duplicate selection, unavailable-sharing feedback and rep-only options/links verified. Screens compared at 1440×1080. Native file-picker automation blocked by ChatGPT Chrome extension's disabled file-URL access; browser file injection was not completed and no permissions were changed. Actual File selection/validation/removal covered by the automated component test. Browser extensions emitted unrelated errors/hydration attribute noise; no claim of a zero-error browser session.
