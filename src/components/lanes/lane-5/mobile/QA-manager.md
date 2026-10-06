# Lane 5 — mobile manager and messages

Base: integration 4659ab1. Mocks: VITE_BYLDA_MOCKS=true. Saved design-ref specs and frames only; no Figma tools.

## Screens and visual review

Native browser captures: design-qa/B2.png, B3.png, B5.png, B7.png and B8.png, 390 × 844. Each compared with its saved frame. One visual correction round: call summary/player/evidence geometry, message header height and alert singular/plural copy. All five loaded routes also fit 320px without horizontal overflow.

Remaining differences (not FIGMA MATCH):
- B2: shared feed contains one coaching candidate rather than three; alert, pattern text and samples differ. Confidence/sample metadata remains visible. No supplied push preview or delivery time.
- B3: shared call is 38:00, outcome pending, actual analysis/evidence text differs. No recording URL, so an unavailable state replaces the waveform. Assignment requires explicit behavior, note, target and call count rather than inventing frame defaults.
- B5: four actual notifications rather than five, real dates/copy; no snooze hook or gesture. Push registration is read-only.
- B7: room has 12 members and two actual messages; no presence/unread/history contract. Metadata-free structured insights are withheld. Message composer is unavailable and reactions are read-only.
- B8: one real message rather than four; no presence/history/send contract. No fabricated dialogue, status or sent success.
- All mobile cards use the required 10px kit radius rather than square frame cards. Text/icons/row heights differ where shared contracts differ.

## Responsive Foundation QA (B10/B11)

Native Home captures at 1280 × 1080 and 1024 × 1080: design-qa/B10.png and B11.png. No horizontal document overflow. At 1024px the 248px secondary sidebar collapses, leaving the 64px rail. The context panel overlays at 1024px (344px wide); at exactly 1280px it is hidden despite its open state. Closing context at 1024px does not persist: it reopens. These are Foundation issues, logged in LANE_REQUESTS; shell unchanged. Current Home content/copy and context metrics differ from the saved frames. B10/B11 are explicitly QA-only references, not Lane 5 screen rebuilds.

## Functional verification

Review follow-up: integrated the rep header correction without losing role-aware
navigation. Messaging headers now use the shared Cinzel `Wordmark` as required by
CLAUDE.md §13.4. Refreshed mobile screenshots and added brand regression coverage.

25 focused tests cover five screens' loading/retry/empty states; manager gate; rep-owned calls and alerts; room membership; DM participation even for managers; peer text/evidence/action suppression; low-confidence actions; team sample thresholds and metadata-free structured blocks. Assignment verified with the existing mock mutation, confirmation disables repeat submission, mock session-only disclosure shown. Message sending, reaction mutation, push changes and snooze stay unavailable without contracts.

Production build passes. Changed-file lint, tokens, boundary and diff checks pass. Typecheck retains exactly eight baseline errors outside this section. Full suite: 464 passed, 36 skipped, two known integration-catalog failures (ReadyMode label and GoHighLevel credential fields). No backend, shared data, kit, shell, router, nav, dependencies or environment files changed.
