# Coaching lists and rep view — G1/G3/G4/G5/G11

Implemented against the saved specs and frames. Public data hooks only. Rep viewers bypass manager lists; own focus and call IDs are checked before rendering links or evidence. Acknowledgement handles pending, failure, mismatched responses and duplicate submissions. Mock acknowledgement is explicitly an unconfirmed local preview.

Progress, verdicts, capacity, calendar, practice scripts and past-result insights are unavailable where the public contracts lack metadata or actions. Follow-up means the explicit not_yet/reverted statuses; no overdue threshold is invented.

Validation: 26 focused tests pass; full suite 618 pass, 36 skipped, two existing failures. Typecheck retains eight baseline errors. Scoped lint, tokens, boundary and production build pass. Browser manager/rep/owner checks at 1440×1080 pass with no console errors; rep manager-route bypass and own evidence checked. G1 captured at its saved 1450×70 size.

Saved-frame comparison: lifecycle structure matches; lists use two active focuses, no follow-up focuses and one completed focus from shared data. Missing insight columns display unavailable rather than frame numbers. G11 preserves the own note and Acme evidence, shows the existing acknowledgement, and omits fabricated past coaching, calendar and practice examples. The shared shell and contract notices change vertical spacing. Screenshots: design-qa/G1.png, G3.png, G4.png, G5.png, G11.png.
