# `@/lib/data` — the data layer

Integration note: normal use never resolves a fixture-only domain to mocks. `resolveSource`
uses its real fetcher, and missing backend features show an unavailable state. Explicit
`VITE_BYLDA_MOCKS=true` enables the labeled demo. SOURCE values below describe upstream
readiness, not permission to show sample data to signed-in users.

**Screens import ONLY from `@/lib/data`.** No `fetch`, no `supabase.*`, no `invokeEdge`, no
hard-coded numbers in a component (`CLAUDE.md` §5). This file is the whole API.

```tsx
import { useCallReview } from "@/lib/data";
import { DataBoundary, systemStates, SystemState } from "@/components/bylda";

const q = useCallReview(callId);
return (
  <DataBoundary query={q} empty={<SystemState {...systemStates.callDeleted()} />}>
    {(review) => <Transcript segments={review.transcript} />}
  </DataBoundary>
);
```

## How it works

- **Every hook** is a TanStack Query hook returning the query result **plus `isEmpty`** —
  the same shape in every mode, so page-17 states (loading / error / empty) compose via
  `DataBoundary`.
- **Every hook knows who is asking** (`useViewer` → `DataCtx`). Loaders enforce rep
  safety from it — see below. Hooks stay disabled until the viewer has loaded.
- **Three sources per domain** — `src/lib/data/<domain>/source.ts`:
  `mock` (fixtures), `real` (Supabase / edge functions), `hybrid` (real where `GAPS.md`
  says AVAILABLE; MISSING fields come back as the contract's defaults — `null`, `0`, `[]`,
  tagged `// GAP:` — **never invented numbers**, per §4 "never fill space with fake
  intelligence"). Screens render `null` as an em dash or the matching page-17 state.
- **`VITE_BYLDA_MOCKS=true`** forces every domain to `mock` (demo, offline, lane work),
  skips the sign-in guard, and enables *profile menu → Demo · view as* (or `?as=rep`).
  Not in `.env.example` — that file is a guarded backend path (`CLAUDE.md` §12 H).
- **Fixtures are minimal**: a few rows per object — enough to render every screen and
  its states (one call per status, a low-confidence insight, an n<30 outcome, a failing
  integration). Don't grow them into a fake dataset.
- **Missing backend objects**: real fetchers throw `NotBuiltError` (`NOT_BUILT: <object>`)
  until Tirth builds them to the contract in `BACKEND_BACKLOG.md`.
- **Swap protocol** (§12 E): when a backend object merges, flip that domain's `SOURCE` in
  one PR. Screens never change. If one would have to, fix `map.ts`.

### Errors a screen must handle

| Error | When | Render |
| --- | --- | --- |
| `ForbiddenForRoleError` (`FORBIDDEN_FOR_ROLE`) | a rep asks for a peer's call / focus / DM / team view | `systemStates.permissionDenied()` (Y9) |
| `NotBuiltError` (`NOT_BUILT`) | real mode on a domain whose backend isn't built | should never reach a screen — the domain's `SOURCE` stays `mock` until it's built |
| anything else | network / RLS | `StateError` with Retry (DataBoundary default) |

## Sources today

| Domain | SOURCE | Sub-sources | Notes |
| --- | --- | --- | --- |
| `auth` | **real** | — | Supabase auth |
| `behaviors` | **mock** | `OBJECTIONS_SOURCE` = hybrid | frequency of objections real |
| `billing` | **hybrid** | — | subscription/invoices/usage real; seats C-32 |
| `calls` | **hybrid** | — | calls/transcripts/insights/jobs real; V1 fields GAP |
| `coaching` | **mock** | — | C-05, C-11 |
| `insights` | **mock** | `HEALTH_SOURCE` = hybrid | insights/feed mock |
| `integrations` | **hybrid** | `CHANNELS_SOURCE` = mock | sources real |
| `methodology` | **mock** | — | C-17..C-19 |
| `notifications` | **hybrid** | — | table real; V1 columns C-24 |
| `onboarding` | **hybrid** | — | responses real; progress C-16 |
| `outcomes` | **mock** | — | C-14 |
| `reports` | **mock** | — | C-13 |
| `rooms` | **mock** | — | Lane 6 mocks only |
| `search` | **mock** | — | C-23 |
| `session` | **hybrid** | — | identity real; V1 roles least-privilege until C-09 |
| `settings` | **hybrid** | `PREFS_SOURCE` = mock | profile/members/audit real |
| `shell` | **mock** | — | sidebar lists |
| `team` | **hybrid** | `TEAMS_SOURCE` = mock | members real |

**18 domains: 8 hybrid · 1 real · 9 mock.**

## Hooks — what each returns, real vs mock per field, who uses it

"Used by" is computed from the screen registry (`FRAMES.md` / `TEAM_START.md`).

### Session & shell

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useViewer` | `Viewer` | auth user, profile, org; owner/admin from `organization_members.role`; V1 role from `workspace_member_roles.role` | team (C-08); V1 role enum (C-09) → least-privilege `rep` | L1, L4 — `A5` `H1` `R3` |
| `useWorkspaces` | `WorkspaceSummary[]` | current workspace | other workspaces (mock list) | shell / infra |
| `useTeams` | `TeamSummary[]` | — | all (C-08) | L4, L5 — `T1` `E4` |
| `useDataCtx` | `DataCtx \| undefined` | derived from useViewer | — | shell / infra |
| `useSidebar` | `SidebarData` | — | rooms, people, DMs, saved (C-33, C-35, C-08) | shell / infra |
| `useHasUnread` | `boolean` | — | V1 notification types (C-24) | shell / infra |

### Auth & onboarding (Lane 4)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useAuthActions` | `{ signIn, signUp, sendReset, updatePassword, resendVerification }` | Supabase auth (all) | mock mode resolves without network | L4 — `A1` `A2` `A3` `A4` `A5` |
| `useOnboarding` | `OnboardingState` | `onboarding_responses` (name, completed) | analysis progress (C-16), methodology template (C-17) | L4 — `A6` `A7` `A8` `A9` `A10` `A11` |
| `useSaveOnboarding` | `mutation(answers)` | `complete-onboarding` edge fn | — | L4 — `A6` `A7` |

### Home & insights (Lane 1)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useHomeFeed` | `HomeFeed { items, attention, coachQueue }` | — | all (C-04, C-07) · **refused to reps** | L1, L5 — `H1` `H2` `H3` `H4` `H5` `H6` `B2` |
| `useInsights` | `GatedInsight[]` (`state: "insight" \| "insufficient"`) | — | all (C-04) · reps get only insights about themselves · below threshold → `insufficient` (§13.13) | L1, L4 — `A11` `I1` |
| `useWorkspaceHealth` | `WorkspaceHealth` | `health_checks` status per endpoint | failed jobs / seats / weekly analyzed / alerts (C-31) | L1 — `H7` |

### Calls (Lane 2)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useCalls` | `Call[]` | id, rep, account/contact names, started, duration, direction, outcome (from `outcome_tag`), status (derived), recording | coachingValue, stageAtCall, opportunityId, type, keyMoments, topMoment (C-06, C-10) · **reps: own calls only** | L1, L2, L4 — `H3` `C1` `C2` `T6` `T10` |
| `useMyCalls` | `Call[]` | as useCalls | as useCalls | L2 — `C9` |
| `useCallReview` | `CallReview` | call, transcript (`speaker_segments`), analysis (`call_insights`), analysis status (`call_analysis_jobs`), sentiment | events (C-01), moments (C-10), coaching (C-05), methodology adherence (C-12) · **peer call → FORBIDDEN_FOR_ROLE → render Y9** | L2, L4, L5 — `R3` `C3` `C4` `C5` `C6` `B3` `B6` |
| `useBehavioralEvents` | `BehavioralEvent[]` | — | all (C-01) | L2 — `C5` |
| `useSavedViews` | `SavedView[]` | — | all (C-30) | L2 — `C1` |
| `useCallComparison` | `CallComparison` | derived from two reviews | — | L2 — `C8` |
| `useUploadCall` | `mutation() → UploadResult` | `get-call-ingest-url` wrapper | — | L2 — `C7` |
| `useReanalyzeCall` | `mutation(callId)` | `analyze-call` wrapper (Y5 Retry) | — | L2 — `C3` `C5` |

### Behaviors, patterns, outcomes (Lane 1)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useBehaviors` | `Behavior[]` | — | all (C-02) | L1, L2, L4, L5 — `I7` `T4` `G2` `E12` |
| `useBehaviorDetail` | `BehaviorDetail` | — | all (C-02, C-03) · refused to reps | L1 — `I2` |
| `useRepScores` | `BehaviorScore[]` | — | all (C-03) · reps: own only · fixed y-range sparklines · `teamMedian` **null under 8 reps** | L4 — `T9` `T12` |
| `usePatterns` | `Pattern[]` | — | all (C-15) · refused to reps | L1 — `I1` `I3` `I7` `I8` `I9` `I10` `I11` |
| `useObjectionStats` | `ObjectionStat[]` | label, count, callCount from `call_insights.objections` | handledWellRate, trend (C-25) · refused to reps | L1 — `I4` |
| `useOutcomeAssociations` | `OutcomeAssociation[]` | — | all (C-14) · returns n<30 rows too — render Y3 via `isOutcomeSufficient()` · refused to reps | L1 — `I2` `I5` `I6` `I9` |

### Coaching (Lane 2)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useCoachingFoci` | `CoachingFocus[]` | — | all (C-05) · reps: own only | L1, L2, L4 — `H4` `T5` `T11` `G3` `G4` `G5` |
| `useMyCoaching` | `CoachingFocus[]` | — | all (C-05) | L2, L4, L5 — `R1` `G11` `B4` |
| `useCoachingFocus` | `CoachingFocus` | — | all (C-05) · peer focus → FORBIDDEN | L2 — `G6` `G7` `G8` `G9` `G10` `G12` |
| `useCoachingComments` | `CoachingComment[]` | — | all (C-11) | L2 — `G10` |
| `useAssignCoaching` | `mutation(AssignCoachingInput)` | — | `assign-coaching` (C-05) · refused to reps | L2, L5 — `C6` `G2` `B3` |
| `useAcknowledgeCoaching` | `mutation(focusId)` | — | `acknowledge-coaching` (C-05) | L2, L5 — `G11` `B4` |

### Team & rep (Lane 4)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useTeam` | `Team` | — | all (C-08) · refused to reps | L4 — `T1` `T2` `T4` `T7` |
| `useTeamMembers` | `Person[]` | org members via `list_org_members` | V1 role, team, presence (C-08, C-09) · reps: themselves only | L2, L4 — `T2` `T3` `G2` |
| `useRepSummary` | `RepSummary` | rep identity | scores, analyzed counts (C-03) · reps: own only | L4 — `T8` `T9` |
| `useRepComparison` | `RepComparison` | — | all (C-26) · **MANAGER-ONLY, refused to reps** | L4 — `T13` |
| `useRepHome` | `RepHome` | — | composes own coaching + own insights + own scores | L4, L5 — `R1` `B1` |
| `useMyProgress` | `MyProgress` | — | own scores + own focus history | L4 — `R2` |

### Reports (Lane 4)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useReports` | `ReportListItem[]` | — | all (C-13) · reps: own rep briefs only | L1, L4 — `H5` `P1` |
| `useBrief` | `Brief (by id or kind)` | — | all (C-13) · a team brief → FORBIDDEN for reps | L4 — `P2` `P3` `P4` `P5` `P6` `P7` `P8` `P9` +1 |

### Rooms & messages (Lane 6 — mocks only)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useRooms` | `Room[]` | — | all (C-33) | L6 — `O1` `O14` |
| `useRoom` | `Room (by id or slug)` | — | all (C-33) | L6 — `O2` `O3` `O4` `O5` `O6` `O7` `O8` `O9` +2 |
| `useRoomMessages` | `Message[]` | — | all (C-34) | L5, L6 — `O2` `O3` `O4` `O5` `O8` `O9` `O10` `O11` +1 |
| `useRoomInsights` | `GatedInsight[]` | — | all (C-33, C-04) · gated like `useInsights` · reps see only their own | L6 — `O3` |
| `useDmThreads` | `DmThread[]` | — | all (C-35) | L6 — `O12` |
| `useDmMessages` | `Message[]` | — | all (C-34, C-35) · someone else's DM → FORBIDDEN | L5, L6 — `O12` `O13` `B8` |

### Notifications & search

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useNotifications` | `Notification[]` | id, read, created, title (= `message`) | V1 type/severity/body/href (C-24) | L1, L5 — `N1` `N2` `B5` |
| `useMarkNotificationRead` | `mutation(id)` | `notifications.read` | — | L1 — `N1` `N2` |
| `usePushRegistration` | `PushRegistration` | — | all (C-36) | L5 — `B4` `B5` |
| `useSearch` | `SearchResponse { filters, results }` | — | all (C-23) · never answers from memory; every result is a call | L2, L5 — `S2` `S3` `B9` |
| `usePaletteItems` | `PaletteItem[]` | — | all (C-23) · reps: calls only | L2 — `S1` |

### Integrations (Lane 5)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useDataSources` | `DataSource[]` | key, connected, status, last update (`user_integrations_masked`) | category, calls synced, waiting (C-20) | L1, L4, L5 — `A8` `H7` `X1` |
| `useDeliveryChannels` | `DeliveryChannel[]` | — | all (C-21) | L5 — `X2` |
| `useIntegrationDetail` | `IntegrationDetail` | source | field mappings (C-22) — read-only direction | L5 — `X3` |
| `useConnectSource` | `mutation(key)` | `startIntegrationOAuth` wrapper | — | L4, L5 — `A8` `X1` |

### Settings, methodology, billing (Lane 5)

| Hook | Returns | Real today | Mock / GAP (contract) | Used by |
| --- | --- | --- | --- | --- |
| `useWorkspaceSettings` | `WorkspaceSettings` | — | timezone, week start (C-27) | L5 — `E1` |
| `useProfile` | `Profile` | `profiles` | title | L5 — `E2` |
| `useMembers` | `Member[]` | org members | status, team (C-08) · refused to reps | L5 — `E3` `E4` |
| `useRoleDefinitions` | `RoleDefinition[]` | frontend constant (the V1 role model) | — | L5 — `E5` |
| `useAnalysisPreferences` | `AnalysisPreferences` | — | all (C-27) | L5 — `E6` |
| `useNotificationPreferences` | `NotificationPreferences` | — | all (C-28) | L5 — `E7` |
| `useRetentionPolicy` | `RetentionPolicy` | — | all (C-27) | L5 — `E8` |
| `useApiKeys` | `ApiKey[]` | — | all (C-29) | L5 — `E17` |
| `useAuditLog` | `AuditEntry[]` | `admin_audit_log` | entity column | L5 — `E18` |
| `useInviteMembers` | `mutation({ emails, role })` | `team-invite` edge fn | — | L4, L5 — `A9` `E3` |
| `useMethodologies` | `Methodology[]` | — | all (C-17) | L1, L4, L5 — `A7` `I8` `E9` |
| `useMethodology` | `Methodology` | — | all (C-17) | L5 — `E10` `E11` `E12` |
| `useObjectionLibrary` | `ObjectionLibraryItem[]` | — | all (C-18) | L5 — `E13` |
| `useSuccessCriteria` | `SuccessCriterion[]` | — | all (C-19) | L5 — `E14` |
| `usePlan` | `Plan` | plan, status, period end, cancel flag (`subscriptions`) | seats (C-32) | L5 — `E15` |
| `useInvoices` | `Invoice[]` | `list-invoices` edge fn | — | L5 — `E15` |
| `useUsage` | `UsageMeter[]` | `usage_tracking` | limits | L1, L5 — `H7` `E16` |

**72 hooks: 10 fully real · 19 hybrid · 43 mock-only** (mock-only = no backing table yet; each has a contract).

## Rep safety — enforced here, tested

There is **no backend guarantee** (RLS on `calls` is org-wide). The loaders enforce it:
`scopeRepId` rewrites any requested rep id to the viewer's own; `assertNotRep` refuses
team-wide / peer / comparison data. `src/lib/data/__tests__/rep-safety.test.ts` proves
it for every rep-reachable loader and for the rep nav.

**Team median (CLAUDE.md §4, §13.6).** `BehaviorScore.teamMedian` is an anonymous
aggregate — one number, never per-rep values — and is **`null` whenever the team has
fewer than 8 reps** (`MIN_REPS_FOR_TEAM_MEDIAN`). It's gated in the data layer, never in
a screen: `gateTeamMedian()` runs in `mapBehaviorScore` (real rows, via `team_size`) and
in `loadRepScores` (mocks), and fails closed when team size is unknown. **Screens must
hide the team-median row entirely when `teamMedian` is `null`** — no "—", no "n/a", no
placeholder. `__tests__/team-median.test.ts` proves 7 → null, 8 → value, and that
rep-scoped hooks never carry per-rep values.

## Insight thresholds — enforced here, tested

CLAUDE.md §13.13. A rep insight needs **≥ `REP_INSIGHT_MIN_CALLS` (10)** analyzed calls,
a team pattern **≥ `TEAM_PATTERN_MIN_CALLS` (50)** (`Insight.callsAnalyzed`). `useInsights`
and `useRoomInsights` return `GatedInsight[]`; an item with `state: "insufficient"` has
no headline — render `SystemState` Y3 with `callsAnalyzed` / `callsNeeded`, never the
insight. `useHomeFeed` and `useBrief` drop below-threshold insights. Helpers:
`gateInsight`, `isInsightSufficient`, `insightScope`. Tested in
`src/lib/data/__tests__/insight-thresholds.test.ts`.

## Contracts & tests

- `src/lib/data/contracts/` — one contract per MISSING object/field (37). Each has the
  proposed columns, example row, mapper, mock and real fetcher. `BACKEND_BACKLOG.md` is
  generated from them: `bun run contracts:doc`.
- `__tests__/contracts/C-NN.contract.test.ts` — schema ⟷ example ⟷ mapper ⟷ mock shape;
  `NOT_BUILT` until built; `BYLDA_CONTRACT_LIVE=1` validates real rows.
- `__tests__/contract-guard.test.ts` — proves the contract checks catch a drifting row.
- `__tests__/adapters-mock.test.ts` — every loader works in mock mode.
- `__tests__/rep-safety.test.ts` — reps get only their own data; peer data is refused.
- `__tests__/team-median.test.ts` — team median null under 8 reps; no per-rep values in rep hooks.
- `__tests__/calls-hybrid.test.ts` — hybrid mapping of today's call rows.
- `__tests__/contracts-doc.test.ts` — BACKEND_BACKLOG.md is not stale.

## Adding something

You don't — `src/lib/data/**` is frozen foundation (§12 A). Need a new field or hook?
Add a row to `LANE_REQUESTS.md` and, meanwhile, a typed local mock in your lane folder.
