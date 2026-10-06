# E6–E8 Settings QA

Built on `origin/integration` at `4659ab1`, branch `lane-5-mayur`. Saved `design-ref/E6`, `E7`, `E8` specs and frames only; no Figma tools. Shared fixtures, frozen kit/data/shell, router/nav, dependencies, environment and backend paths unchanged.

## Behavior and limits

- E6 is owner/admin only. Fixed rep threshold uses `REP_INSIGHT_MIN_CALLS` (10). Call-duration and internal-call preferences are editable local drafts from `useAnalysisPreferences`. No configurable coaching-confidence, baseline or outcome-association setting exists. Save and reset explain that nothing was saved/reset. No causal claim.
- E7 personal preferences remain accessible to reps. `useNotificationPreferences` supplies one channel, generic type booleans and optional quiet hours. Only explicit keys render switches on the selected channel; absent type/channel cells stay unspecified, not false. Channel edits preview the same type preferences, with explicit disclosure. Unknown shared keys also render. Quiet-hour times are editable; incomplete pairs are rejected. No push/batching or brief-exception behavior is invented.
- E8 is strictly owner-only (admins denied). Exact recording/transcript day counts are editable drafts. PII draft uses `useAnalysisPreferences`, not an invented retention field. Missing event retention, consent, model-training policy, region and documents show unavailable. Export/deletion buttons explain no action was performed. `deleteOnRequest=false` disables deletion. No 24-hour export, region or shared-model guarantee is invented.
- All drafts reload to the shared values; no persistence mutation exists. Missing contracts logged as LANE_REQUESTS #39; editable switch and optional settings-table widths as #38 (`fold-into-kit`). Query surfaces use DataBoundary for loading/error/empty. Permission state uses kit Y9 with settings-specific copy, not its default peer-call example.

## Visual comparison — one correction round

Compared browser screenshots at native **1440×1080** with all three saved frames. One correction round adjusted E7 table column sizing and E6’s derived duration label to minutes. Corrected screenshot files: `design-qa/E6.png`, `E7.png`, `E8.png`, owner role, untouched initial shared values. Chrome screenshots were saved as JPEG and converted losslessly from those captures to PNG; compression differences remain.

Remaining differences (no FIGMA MATCH claim):

- All: frozen shell repeats Settings in breadcrumbs; workspace subtitle, active rail, icons, room/DM rows differ (request #37). Native select arrows, 6px controls per CLAUDE §13, and minor settings-row spacing differ. E6 footer is roughly 6px higher; E8 note position/height differs. No second correction round.
- E6: 10-call locked policy vs Figma’s editable 20; shared 2-minute minimum vs Figma 3. Missing confidence/baseline/outcome controls show unavailable. Domain-specific internal-call prose cannot be supplied. Locked noncausal-language copy follows policy.
- E7: three shared Slack type flags vs Figma’s full four-channel matrix; other cells use dashes. Header/column positions still slightly differ. Added single-channel selector, explanation and Save, rather than implying per-channel persistence. Quiet hours are shared 19:00–08:00 vs 19:00–07:00; native time inputs replace the preset dropdown. Missing batching toggle shows unavailable; extra rows move quiet hours/batching lower.
- E8: exact 365-day transcript value vs 12 months. Missing event retention/consent/training controls and DPA/subprocessor/region details show unavailable; no fake policy badges. Added Save and draft notices. Action hints state missing contracts instead of promising deletion, export format/time or storage location.

## Validation

- Scoped lint: 6 changed TS/TSX files, clean. Tokens, backend boundary (15 patterns) and diff check clean.
- Typecheck: exactly the 8 documented baseline errors, no Lane 5 errors.
- Settings suite: **11 passing** (4 new preference scope/non-inference/state tests plus 7 existing).
- Full suite: **443 passing, 36 skipped, 2 known integrations-catalog failures**.
- Production Vite build with `VITE_BYLDA_MOCKS=true`: pass.
- Browser: analysis duration/internal drafts, unsupported reset/save, reload restoration; E7 keyboard switches, channel preview preserving flags, native quiet-hour edits and incomplete-pair rejection, save/reload; E8 duration/PII draft, keyboard switch, no-op export/deletion/save and reload restoration. Owner/admin/rep access boundaries also checked via tests and browser.
- Host lacks bun and has Bash 3 without mapfile; used existing package binaries and the previous uncommitted Bash compatibility shim/local ESLint launcher. No packages installed or repo scripts changed.

Stopped after opening the section PR; E9+ untouched. Lane 5 is not complete, so no next-lane handoff was sent.
