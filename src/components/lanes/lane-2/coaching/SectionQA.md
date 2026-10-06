# Lane 2 — Assign coaching and result (G2/G12)

Scope: G2/G12, local coaching compositions/model/tests, this QA and screenshots; thin routes and C3–C6 unchanged. Dedicated clone, no subagents, live Figma or other-chat writes. PRs #38/#39 already merged at integration `036c673`; lane started at `3f2358c`, no lane-only commits, safely fast-forwarded. Final remote branch check occurs before push; no force push.

Saved sources: G2 `14:24`, G12 `14:224`, tokens/foundations/component specs, CLAUDE §13. No standalone Dev Handoff saved export exists; CLAUDE §4/§13 supplies the handoff rules. LANE_REQUESTS #58–#61 enumerate contract/object/design differences. Shared data is unchanged.

G2: loaded viewer gate before assignment/member hooks; owner/admin/manager/coach allowed, rep/viewer denied. Only loaded reps and enabled behaviors offered. Manual note/finite numeric target/positive integer call count validation. Public mutation receives exactly supported fields, including empty evidence. Pending disables inputs/submit/dismiss; errors retain draft for retry. Returned ID and matching rep/behavior are checked and displayed without a fake persisted link. Current public mock returns a local preview only. No confirmed persistence/capacity/delivery; check-in and posting unavailable.

G12: requested focus ID and loaded viewer ownership verified before rendering. Rep peer response/ForbiddenForRoleError contains no peer name, note, IDs or call links. Missing/loading/failure+retry/stale-ID/no-result handled. Confidence and windows absent, so values/verdict/chart/action remain withheld at n=5 and n=100. Invalid samples withheld. Public rep threshold=10; outcome associations absent and require n_closed≥30. No chart autoscale, causal language or substituted whole-call comparison.

Verification, 2026-10-02:

- Focused regression: **77/77 pass** (10 section, 47 prior Calls, 20 public rep-safety).
- Full suite: **549 pass, 36 skipped, 2 fail** across 81 files. Only known integrations-catalog failures: ReadyMode popular field and multi-credential fallback.
- Typecheck: **exactly 8 baseline errors**, no lane errors. ConnectSources (4), use-operator-data (1), app.context-memory (1), sales-verticals (2).
- Production build: pass, client/server generated. Existing bundle/chunk and Vercel OIDC warnings are not introduced by this section.
- Scoped lint / tokens / boundary: pass. Host macOS Bash 3.2 lacks mapfile, and host npm launcher is stale. Unchanged repository scripts run with a task-local BASH_ENV shim implementing their `mapfile -t` use and dispatching npx eslint to the installed binary. No repo scripts/dependencies/env edits.
- Browser: installed Chrome via bundled Playwright, VITE_BYLDA_MOCKS=true, 1440×1080, manager/rep/owner; **pass, zero page errors**. Actual blank validation, rep/behavior changes, fractional call rejection, submit/returned ID, no fake ID link, cancel/Escape navigation, manager/owner assignment/result, rep denied assignment/peer result and rep own no-result view.

Visual QA: viewed both final PNGs against saved frames. G2's modal width/centering and section arrangement preserved; added selector and missing-contract copy alter height, blank fields deliberate. Original repeated blank background cards omitted because no coaching index is in this section. G12's chart/card widths, before/after layout and action row preserved; explicit unavailable states replace unsupported design metrics/chart/clips. #59 records exact shared values, not display overrides. Token radius/shadow wins over frame. Shared shell copy/icons and content-driven text/row positions differ. No pixel-identical claim.

Screenshots: manager initial assignment (`design-qa/G2.png`), manager Alex result (`design-qa/G12.png`). One section PR into integration; stop for review. **Three Lane 2 sections remain**, including coaching detail, coaching index/rep view, Search & Ask. No claim that Lane 2 is complete.
