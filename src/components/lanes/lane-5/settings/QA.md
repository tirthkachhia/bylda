# Lane 5 — Settings E1–E5

Built from saved `design-ref/E1`–`E5` specs and frames on integration 141369c. No Figma calls. Integrations X1–X3 were already merged in #4; system states were built in Foundation. This section replaces only the five Settings placeholders.

## Implemented

- Light Settings navigation, shared kit Button/Avatar/Tag, token-based form/list primitives (`Local*`, request #34).
- E1: editable workspace-name/time-zone/week-start drafts. Save explains that persistence is unavailable; reload restores shared values.
- E2: editable name/email drafts, shared profile/avatar/role. Unsupported photo, brief delivery, password, 2FA and session actions explain that nothing was saved.
- E3: managers see only their own team/self; workspace-wide invitations are owner/admin only because the existing invite hook has no team scope. Member list and counts derived from shared members; invite form validates/deduplicates addresses and calls `useInviteMembers`. Forced mocks explicitly state that no email was sent or member saved. Manage/resend remain unsupported.
- E4: managers see only their own team; shared team names/rep counts; manager identity resolved only when a matching member exists. Create/edit/setup explain the missing mutation.
- E5: read-only matrix generated from shared role grants, preserving Admin and all supplied roles. A dash means not specified, not a fabricated denial. Own/team scopes stay distinct. Call-read never implies audio/peer-profile/sharing grants. Privacy is fixed to §13; no peer-access toggle or leaderboard action.
- DataBoundary loading/error/empty states. Profile available to the viewer; workspace configuration restricted to owner/admin; members/teams/roles refused to reps, viewers and coaches. UI gating is not a replacement for backend authorization.

## Saved native QA

`design-qa/E1.png`–`E4.png`: **1440 × 1080**. `E5.png`: **1440 × 1156**. E2 captured as manager; the others as owner. Browser uses `VITE_BYLDA_MOCKS=true`.

Compared every screen with its saved frame. **One correction round**: light-nav group spacing, compact table actions, role-label casing, E5 spacing. No claim of exact Figma match.

Remaining differences:

| Screen | Remaining difference / reason |
| --- | --- |
| All | Frozen shell repeats Settings in the breadcrumb, uses a team workspace subtitle, different Lucide icons/active rail and role-dependent room/DM rows (#37). Native select arrows differ from the drawn chevron. Controls follow §13's 6px radius. |
| E1 | Domain/language/join settings absent, rendered unavailable. No save/delete action or deletion-retention contract; danger panel stays neutral per behavioral-only signal-color rule rather than inventing a seven-day policy (#35). |
| E2 | Shared email differs (`dana@acme-revenue.test`). Missing schedule, password age, 2FA/session state cannot reproduce design values; unavailable actions use explanatory controls instead of fake selected values (#35–36). |
| E3 | Shared cast is 7 members / 1 invited (Alex), rather than 12 / 2 and the eight design rows. No per-user call totals/activity/unmatched voice. No invented rows or totals. Invited tag is neutral per token guidance; action column labels explicit (#35–36). |
| E4 | Enterprise manager unavailable; no team methodology/brief time. Shared counts remain 9/4/0. Setup/edit are compact explanatory actions rather than simulated edits; missing-field note adds height (#35–36). |
| E5 | Six shared roles, including Admin, rather than five design columns; generic grants do not provide detailed Figma cells. Separate workspace/billing/integration rows and a Reports row retain distinct shared grants. Privacy copy obeys §13: anonymous median only on R2 with ≥8 reps. No editable shared privacy contract (#36). Matrix typography/column widths and resulting vertical positions differ. |

The faithful supported structure and local drafting base are implemented; this is **not persistence-ready or exact-design-ready** pending the shared contracts/actions. No lane-local fixture overrides.

## Validation

- Scoped lint and tokens: pass (9 TS/TSX files).
- Backend boundary: pass; backend, frozen shared files, routes/nav, dependency and environment files unchanged.
- Typecheck: exactly the documented **8 baseline errors**, none in Lane 5.
- Scoped tests: **7 passed** (permission scoping/non-inference; empty/loading/error/rep restriction).
- Full suite: only the two documented `integrations-catalog` failures; **439 passed / 36 skipped / 2 baseline failures**.
- Production build with forced mocks: pass.
- Browser interaction checks: draft reload restores shared name; unsupported-action disclosure; invalid email rejection; mock invite disclosure and unchanged members; profile draft notice; rep restrictions.

Runtime note: `bun` is absent. Used installed Vite/TypeScript/Vitest binaries; no dependencies installed or changed. Ran repository `lint-changed`/`boundary` scripts with an uncommitted Bash `mapfile` compatibility function; `npx` was redirected to the existing local ESLint binary because this host's npx launcher points at a missing app path.
