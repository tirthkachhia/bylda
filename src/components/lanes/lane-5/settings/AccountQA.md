# Billing, usage, API keys and audit log — E15–E18

Built from `design-ref/<code>/spec.md` and `frame.png`; no Figma tools.
Native Chrome at port 8082 with `VITE_BYLDA_MOCKS=true`, owner role.
E15: 1440×1156; E16–E18: 1440×1080, matching their saved frame sizes.
Final screenshots: `design-qa/E15.png` through `E18.png`. Browser screenshots
were JPEG and converted to PNG; compression limits exact pixel comparison.

All four initial screenshots compared against saved frames. **One correction round**:
compact billing summary and expandable invoice details, usage strip height,
usage/webhook/audit table columns and audit timestamp presentation.

## Remaining differences (not FIGMA MATCH)

- Frozen shell has duplicated Settings breadcrumbs, Mid-Market AE · 9 reps workspace
  subtitle, different icons/rail selection and role-specific rooms/DMs.
- §13 governs neutral functional tags/notes and 6px controls/10px cards.
- E15: actual plan is Scale/active, 14 used of 20 seats, period ends Oct 31, 2026.
  No tier prices/features/billing cadence/payment method supplied. Cards show missing
  prices rather than saved placeholder prices or promised entitlements; uniform card
  heights differ from reference. Extra Plan status row; one actual invoice ACME-0009
  reveals Sep 1, 2026 / $2,400 paid with no document URL. Scope note differs and sits
  about 6px lower than reference. Plan changes/checkout unavailable.
- E16: shared usage includes 486 calls and 14 of 20 seats for Sep 2026. Audio hours,
  failures, daily history, team breakdown and cost are unavailable. Chart retains its
  frame but has no invented bars; team table shows unavailable. Extra usage-meter
  table preserves every supplied row/period/limit, including null limits.
- E17: one actual key Data warehouse export, suffix 9f2c, scopes calls.read and
  insights.read, last used Sep 29, 2026. No invented byl_live prefix/full key,
  relative-use time, second key or webhook endpoints/health. Webhooks table is shorter.
  Scale-plan eligibility and key creation/revocation are not supplied.
- E18: two actual events rather than six saved examples; full actor names and UTC
  timestamps. No implied access-playback or retention events. Table is shorter.
  CSV exports only loaded entries, not a complete server audit history.

## Validation

- Typecheck: exactly the eight documented baseline errors, none from this section.
- lint:changed, tokens:check, boundary and production build pass.
- Full suite: 459 passed, 36 skipped, two known integrations-catalog failures (497 total).
- Twenty new focused tests cover formula-safe CSV, quoting/newlines, non-mutating sort,
  safe invoice links, absent usage limits, pre-query role denial and stale export suppression.
- Native browser: invoice details reveal actual fields, Switch/Create key explicitly
  report no change, owner navigation retains the demo role, all four rep routes deny access.
- Export link has filename `bylda-audit.csv`; decoded CSV matches two loaded audit entries.
  Native click attempted, but download event timed out. Chrome's downloads page was
  blocked by browser security policy; downloaded-file existence is **unconfirmed**.
  No alternate browser surface or policy workaround was attempted.

No billing/security mutations were performed. Missing fields/contracts in requests
#43–#45. LocalSettings and its Link test stub reuse pending PR #34 identically.
This section is on a separate branch from integration while PRs #33/#34 are open.
