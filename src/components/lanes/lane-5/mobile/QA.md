# Lane 5 — Mobile rep: B1, B4, B6, B9

Built from the saved `design-ref/<code>/spec.md` and `frame.png`, with no Figma calls. Branch `lane-5-mayur-mobile-rep` starts from `origin/integration`; prior E6–E18 drafts remain separate.

## Native visual verification

Chrome at 390 × 844, dev server `http://127.0.0.1:8082`, `VITE_BYLDA_MOCKS=true`, `?as=rep`. Compared all four initial captures to saved PNGs, then performed **one correction round**: B1 focus height and navigation alignment; B4 heading/note spacing; B6 player height, exact transcript timestamps and duplicate quote removal; B9 compact editable filter labeling. Final screenshots are `design-qa/B1.png`, `B4.png`, `B6.png`, `B9.png`. Browser captures were JPEG, converted to PNG; compression prevents claiming pixel equality.

Remaining differences:

- All screens use BYLDA instead of a fabricated OS time. Cards use the required 10px semantic radius (CLAUDE §13), rather than square reference cards.
- B1: shared insight/focus copy differs; confidence + sample size are added as required. No dated brief/day counter or 90-second clip duration contract. View focus replaces Got it because the shared focus is already acknowledged/measuring. Added Coach entry. These differences shift vertical positions.
- B4: focus title/note/quote, speaker, measured-on calls and metric come from the shared model. No assigning-manager profile contract, so the note uses a neutral heading. The fixture is already acknowledged; the button is disabled. Push registration is read-only and unavailable. These differences change wrapping and spacing.
- B6: no recording URL, waveform, clip duration, or playback-rate contract in the fixture. The player shows Recording unavailable, never fake bars/playback. Actual selected moment and following transcript replace reference quotes. Existing own coaching note replaces the design’s suggested response.
- B9: no conversational coaching answer, comparison evidence, practice action, message history/time, or attachment hook. Render owned call search results with editable parsed filters instead of inventing a coach response; no Practice this or attachment affordance. Questions replace the entire query when filters are edited because useSearch accepts a string, not structured filters. Send is text rather than a decorative icon.

## Behavior and privacy

Rep-only gate mounts data-consuming children only for a rep. B1 hides team patterns and insights below 10 analyzed calls, shows confidence/sample, and validates evidence call ownership. B4 resolves the requested ID against own foci, checks evidence against own calls before displaying quotes, and invokes only the shared acknowledgement mutation. Already acknowledged focuses cannot be acknowledged twice; successful acknowledgements are reflected locally since mock invalidation does not persist writes. Manager-question links resolve a shared DM thread containing both participants; missing threads remain unavailable. Push registration is read-only.

B6 uses a local evidence address `callId~tSeconds`, derived from actual evidence; no shared opaque moment-ID resolver exists. Malformed/opaque keys and nonexistent timestamps show empty states. Call ownership is checked again before any evidence/transcript is rendered; FORBIDDEN_FOR_ROLE shows Y9 with generic copy and no invented access-request action. Audio uses native controls only when a real recording URL exists, seeks to the selected evidence time, and offers bounded ±10-second controls.

B9 never answers from memory. Every result is validated against useMyCalls and links to the matching call. Visible filters can be edited to rerun the query. Loading, error/retry, forbidden, and empty states wrap shared hook results. No data-layer/backend/kit/router/nav/dependency/env changes.

Chrome verified brief → coaching → moment with ?as=rep retained, coach query pricing → two owned results, editing to Acme Logistics → one owned result, foreign focus denied, malformed moment empty, no horizontal overflow at 390 and 320. Calls list and coaching list link to existing desktop rep indexes because the next mobile section has no mobile index route. Mobile call and DM targets remain placeholders belonging to the next section.

## Validation

Review follow-up: mobile header branding now uses the shared `Wordmark` (Cinzel),
per CLAUDE.md §13.4. Removed the duplicate BYLDA text that stood in for an OS
time; the wordmark retains its right alignment. Coach branding uses the same kit
component. No shared kit or data changes. A regression test checks brand typography.

- Mobile tests: 20 passed, covering ownership, evidence leakage, threshold gating, state rendering, mutation target/status, search scoping, and malformed moment addresses.
- Full suite: 459 passed, 36 skipped, 2 pre-existing integrations-catalog failures (497 total).
- Typecheck: exactly 8 pre-existing errors, none in this section.
- Production build passed. Changed-file lint, tokens, backend boundary and diff whitespace passed.
- Bun is unavailable. Used installed Node binaries and existing scratch Bash compatibility shim; no dependency/env edits.

## Lane status

Integration contains X1–X3, E1–E5 and foundation system states. E6–E8 (#33), E9–E14 (#34), E15–E18 (#35) remain open drafts. Next section: mobile manager + messages B2/B3/B5/B7/B8, then remaining responsive QA as documented in TEAM_START. Lane 5 is not finished; do not notify the main chat yet.
