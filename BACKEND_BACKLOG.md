# BACKEND_BACKLOG.md — what the backend builds, in order

**Owner:** Tirth (backend track). **Rule:** the frontend defines the backend. Every
item below is built **to its contract** — the view-model shape the screens already
consume, the proposed table/columns, and the endpoint. Each contract has a Vitest
contract test under `src/lib/data/__tests__/contracts/`; an item is **Done** only
when that test passes against the real fetcher (`SOURCE = 'real'`).

Process (`CLAUDE.md` §12 D–E):

1. Branch `backend/<object>` off `integration`. Label the PR **`backend`** — the guard
   rejects boundary paths on any other branch/label combination.
2. Build to the contract below. If the contract is wrong, change it **here first**
   (Ansh approves), then the mapper and test, then the backend.
3. When it merges: set its status to **Done** here, and in the **same PR** flip
   `src/lib/data/<domain>/source.ts` to `'real'` or `'hybrid'`. Screens never change.

Lanes never wait on this list — every item is mocked behind the same hook today.

## Order

| # | Item | Contract(s) | Branch | Status |
| --- | --- | --- | --- | --- |
| **0 · P0** | **Rep-scoped call access at the database level** (below) | C-06, C-09 | `backend/call-access` | Not started — **required before any real customer** |
| 1 | Auth fixes (below) | — | `backend/auth-fixes` | Not started |
| 2 | Regenerate `src/integrations/supabase/types.ts`; delete `src/lib/data/db-types.ts` | — | `backend/types-regen` | Not started |
| 3 | `BehavioralEvent` | C-01 | `backend/behavioral-event` | Not started |
| 4 | `Behavior` (+ weekly behavior scores) | C-02, C-03 | `backend/behavior` | Not started |
| 5 | `Insight` (+ home feed) | C-04, C-07 | `backend/insight` | Not started |
| 6 | `CoachingFocus` (+ discussion) | C-05, C-11 | `backend/coaching-focus` | Not started |
| 7 | `calls.coaching_value` + `stage_at_call` (+ the rest of the V1 call row) | C-06 | `backend/call-fields` | Not started |
| 8 | `OutcomeAssociation` | C-14 | `backend/outcome-association` | Not started |
| 9+ | Every remaining contract, in contract order (C-08 teams, C-09 roles, C-10 moments, C-12, C-13 briefs, C-15…C-36) | see below | `backend/<domain>` | Not started |

Items 7 and 8 were **swapped on 2026-09-30** (Ansh): `calls.coaching_value` +
`stage_at_call` unblock Flow 1 (they rank `C1`, `H1`, `H3`), so doing them before
`OutcomeAssociation` (Flow 3/9, Intelligence) completes the Flow 1 demo on real data one
item sooner. The contract numbering below already follows flow order.

## 0. P0 — call access must be rep-scoped at the database level

**Required before any real customer.** Approved 2026-10-01 (Ansh, `CLAUDE.md` §13.11).

Call access must be rep-scoped in the database, not only in the UI:

| Role | May read |
| --- | --- |
| rep | **only their own calls** (`calls.user_id = auth.uid()`) — and the transcripts, insights, events and moments of those calls |
| manager | calls of reps on the teams they manage |
| owner / admin | every call in the workspace |

Today RLS on `calls` is `is_org_member(organization_id, auth.uid())` (migration
`20260719000006`): any member reads every call in the org. The BYLDA Coach privacy claim
(*"Coach only sees your calls"*, O13) and the "reps never see peer data" rule (§4) both
depend on this; until it lands they are enforced only by `src/lib/data` filtering.
Apply the same scoping to `call_transcripts`, `call_insights` and every per-call table
added by C-01 / C-10. Needs C-08 teams + C-09 roles to be authoritative. Done when a
contract test proves a rep JWT cannot read a peer's call row.

## 1. Auth findings (from `AUDIT.md`, re-verified 2026-09-30)

| Finding | Where | Fix to make |
| --- | --- | --- |
| `sequence-runner` is `verify_jwt = false` but is called from the signed-in app (`src/lib/crm.ts`) with an `org_id` in the body | `supabase/config.toml` | Set `verify_jwt = true`, **or** keep it false for cron and add an explicit org-membership check on the caller's JWT. Decide which, document it here. |
| 6 functions called from the frontend have **no** `[functions.<name>]` block, so they run on the platform default (`verify_jwt = true`) by accident rather than by decision: `operator`, `advance-mission`, `run-workflow`, `automation-dispatch`, `generate-course`, `log-activation-event` | `supabase/config.toml` | Add an explicit block for each. `log-activation-event` is hit by a raw `fetch` from `src/lib/analytics.ts` — confirm it sends the bearer token. |
| `cs-health`, `forecast-rollup`, `marketing-attribution`, `weekly-review` are `verify_jwt = false`, called from the browser with `org_id` in the body | functions + config | Read each: does it verify org membership itself? If not, same fix as `sequence-runner`. (`book-appointment` is correctly public.) |
| RLS on `calls` is `is_org_member(organization_id, auth.uid())` — any member reads every call in the org | migration `20260719000006` | V1's "reps never see peer data" rule is UI-only today. **Now P0 — see item 0 above.** |

## Contracts

Generated from `src/lib/data/contracts/` — **edit the contract there, then run
`bun run contracts:doc`.** `src/lib/data/__tests__/contracts-doc.test.ts` fails when this
section is stale, and each contract's own test fails when a real row stops matching.
Live check once a backend object lands: `BYLDA_CONTRACT_LIVE=1 BYLDA_CONTRACT_EMAIL=…
BYLDA_CONTRACT_PASSWORD=… BYLDA_CONTRACT_ORG_ID=… bun run test src/lib/data/__tests__/contracts`.

<!-- CONTRACTS:START — generated by `bun run contracts:doc`, do not edit by hand -->

**37 contracts** — every field `GAPS.md` marks MISSING, ordered by the screens they unblock (demo Flow 1 · Manager day first). Each one: the view model the screens already use, the proposed table/columns, the endpoint, and a Vitest contract test.

| # | Contract | Unblocks | Screens | Status |
| --- | --- | --- | --- | --- |
| C-01 | [BehavioralEvent — the atomic layer](#c-01) | Flow 1 · Manager day | 5 | Not started |
| C-02 | [Behavior — template-driven behavior definitions](#c-02) | Flow 1 · Manager day | 7 | Not started |
| C-03 | [Behavior scores — per rep / team, weekly, fixed y-range](#c-03) | Flow 1 · Manager day | 8 | Not started |
| C-04 | [Insight — headline + evidence + confidence + sample size](#c-04) | Flow 1 · Manager day | 13 | Not started |
| C-05 | [CoachingFocus — Focus · Evidence · Acknowledgement · Result](#c-05) | Flow 1 · Manager day | 16 | Not started |
| C-06 | [Call V1 fields — coaching_value, stage_at_call, opportunity, account, type, status](#c-06) | Flow 1 · Manager day | 9 | Not started |
| C-07 | [Home feed — ranked insights per tab + attention + coach queue](#c-07) | Flow 1 · Manager day | 9 | Not started |
| C-08 | [Teams + team members](#c-08) | Flow 1 · Manager day | 10 | Not started |
| C-09 | [V1 roles — owner · admin · manager · rep · viewer · coach](#c-09) | Flow 0 · Sign in | 4 | Not started |
| C-10 | [Call moments — labelled key moments with deep links](#c-10) | Flow 1 · Manager day | 6 | Not started |
| C-11 | [Coaching discussion comments](#c-11) | Flow 1 · Manager day | 2 | Not started |
| C-12 | [Methodology adherence per call](#c-12) | Flow 1 · Manager day | 2 | Not started |
| C-13 | [Briefs — daily / weekly, manager / rep / team / behavior](#c-13) | Flow 1 · Manager day | 15 | Not started |
| C-14 | [OutcomeAssociation — behavior × outcome (association only)](#c-14) | Flow 3 · Pattern | 4 | Not started |
| C-15 | [Patterns — emerging team / rep / prospect / outcome / methodology patterns](#c-15) | Flow 3 · Pattern | 8 | Not started |
| C-16 | [Workspace analysis progress](#c-16) | Flow 4 · Sign up & connect | 3 | Not started |
| C-17 | [Methodology — template, stages, behavior rules](#c-17) | Flow 4 · Sign up & connect | 6 | Not started |
| C-18 | [Objection library](#c-18) | Flow 4 · Sign up & connect | 2 | Not started |
| C-19 | [Success criteria — which outcomes Bylda learns from](#c-19) | Flow 4 · Sign up & connect | 2 | Not started |
| C-20 | [Data source sync stats — calls synced, waiting backlog, category](#c-20) | Flow 4 · Sign up & connect | 4 | Not started |
| C-21 | [Delivery channels — Slack · Teams · email · push, separate from sources](#c-21) | Flow 11 · Connections | 2 | Not started |
| C-22 | [CRM field mapping (read-only)](#c-22) | Flow 4 · Sign up & connect | 2 | Not started |
| C-23 | [Search — question → visible filters → calls (never answers from memory)](#c-23) | Flow 8 · Ask & find | 5 | Not started |
| C-24 | [Notifications — V1 types, severity, title/body, link](#c-24) | Flow 8 · Ask & find | 4 | Not started |
| C-25 | [Objection stats — handled-well rate + weekly trend](#c-25) | Flow 9 · Intelligence | 2 | Not started |
| C-26 | [Rep comparison — MANAGER-ONLY](#c-26) | Flow 10 · Team | 1 | Not started |
| C-27 | [Workspace settings — timezone, analysis preferences, retention](#c-27) | Flow 12 · Settings | 4 | Not started |
| C-28 | [Notification preferences (per user)](#c-28) | Flow 12 · Settings | 1 | Not started |
| C-29 | [API keys](#c-29) | Flow 12 · Settings | 1 | Not started |
| C-30 | [Saved call views](#c-30) | Flow 1 · Manager day (C1 entry) | 1 | Not started |
| C-31 | [Workspace health (owner home)](#c-31) | Flow 0 · Sign in (owner lands on H7) | 1 | Not started |
| C-32 | [Seats on the subscription](#c-32) | Flow 12 · Settings | 3 | Not started |
| C-33 | [Rooms](#c-33) | Flow 6 · Rooms | 10 | Not started |
| C-34 | [Messages, threads, reactions](#c-34) | Flow 6 · Rooms | 9 | Not started |
| C-35 | [Direct-message threads (incl. BYLDA Coach DM)](#c-35) | Flow 2 · Rep day (Coach DM) | 5 | Not started |
| C-36 | [Mobile push registration](#c-36) | Flow 2 · Rep day (mobile) | 4 | Not started |
| C-37 | [Call comparison — derived client-side (no backend)](#c-37) | Flow 1 · Manager day (optional) | 1 | Derived — no backend |

<a id="c-01"></a>

### C-01 · BehavioralEvent — the atomic layer

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day · Flow 3 · Pattern

**Screens:** `C3` `C5` `R3` `I2` `B6`

**Closes GAPS.md:** 07 behavioral event timeline on the waveform; 07 moment player deep-link; 08 every behavior metric (computed from events)

**View model the screens use** — `BehavioralEvent` (`src/lib/data/types/behavior.ts`):

```ts
export type BehavioralEvent = {
  id: ID;
  callId: ID;
  type: BehavioralEventType;
  /** seconds */
  tStart: number;
  tEnd: number;
  speaker: "rep" | "prospect" | "other";
  attrs: Record<string, string | number | boolean | null>;
  detectorVersion: string;
};
```

**`behavioral_events`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  | → organizations.id |
| `call_id` | uuid |  | → calls.id · on delete cascade |
| `type` | enum(objection \| interruption \| question \| monologue \| pause \| sentiment_shift \| control_shift \| stage) |  |  |
| `t_start` | numeric |  | seconds from call start |
| `t_end` | numeric |  |  |
| `speaker` | enum(rep \| prospect \| other) |  |  |
| `attrs` | jsonb |  | detector-specific, e.g. { category: 'price' } |
| `detector_version` | text |  | immutable rows, versioned by detector (Dev Handoff) |
| `created_at` | timestamptz |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only — reps: only events on their own calls

Notes: Append-only. Re-detection writes a new detector_version; never UPDATE. Index (call_id, t_start).

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/behavioral_events?call_id=eq.{id}&order=t_start` | call_id | BehavioralEventRow[] | JWT + RLS |
| edge | `detect-behaviors` | { call_id } | { ok, events_written: number, detector_version } | service role (called by analyze-call) |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "ev_1",
  "organization_id": "org_acme",
  "call_id": "call_acme",
  "type": "objection",
  "t_start": 1119,
  "t_end": 1122,
  "speaker": "prospect",
  "attrs": {
    "category": "price"
  },
  "detector_version": "objection@0.1",
  "created_at": "2026-09-28T15:00:00Z"
}
```

Mapper: `src/lib/data/behaviors/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-01.contract.test.ts`

<a id="c-02"></a>

### C-02 · Behavior — template-driven behavior definitions

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 3 · Pattern

**Screens:** `I2` `I7` `T4` `E11` `E12` `G2` `A7`

**Closes GAPS.md:** 05 behavior name + direction; 08 behaviors; 16 behavior rules list / editor

**View model the screens use** — `Behavior` (`src/lib/data/types/behavior.ts`):

```ts
export type Behavior = {
  key: string;
  name: string;
  definition: string;
  rule: Record<string, unknown>;
  methodologyId: ID | null;
  enabled: boolean;
  higherIsBetter: boolean;
};
```

**`behaviors`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `key` | text |  | stable slug, unique per org |
| `organization_id` | uuid |  |  |
| `name` | text |  |  |
| `definition` | text |  |  |
| `rule` | jsonb |  | detector rule — which events, what measure |
| `methodology_id` | uuid | yes | → methodologies.id |
| `enabled` | bool |  |  |
| `higher_is_better` | bool |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admins (Methodology → Behavior rules)

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/behaviors?enabled=eq.true` | — | BehaviorRow[] | JWT + RLS |
| postgrest | `PATCH /rest/v1/behaviors?key=eq.{key}` | { enabled?, rule?, definition? } | BehaviorRow | JWT, admin |

**Example row** (the contract test validates this against the column spec):

```json
{
  "key": "pause_after_objection",
  "organization_id": "org_acme",
  "name": "Pause after objection",
  "definition": "Seconds of silence after an objection before the rep responds.",
  "rule": {
    "event": "objection",
    "measure": "gap_seconds"
  },
  "methodology_id": "meth_meddic",
  "enabled": true,
  "higher_is_better": true
}
```

Mapper: `src/lib/data/behaviors/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-02.contract.test.ts`

<a id="c-03"></a>

### C-03 · Behavior scores — per rep / team, weekly, fixed y-range

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day

**Screens:** `T8` `T9` `T12` `R1` `R2` `H1` `I2` `B1`

**Closes GAPS.md:** 06 my strengths / leaks; 06 my progress over time (rep_metrics); 09 behaviors heatmap per rep; 09 team-level trend

**View model the screens use** — `BehaviorScore` (`src/lib/data/types/people.ts`):

```ts
export type BehaviorScore = {
  behaviorKey: string;
  name: string;
  value: number;
  unit: "ratio" | "seconds" | "per_call" | "percent" | "count";
  /** Anonymous aggregate. `null` when the team has fewer than 8 reps (§4, §13.6) — hide the row. */
  teamMedian: number | null;
  direction: Direction;
  confidence: Confidence;
  sampleSize: number;
  sparkline: Sparkline;
};
```

**`behavior_scores`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `subject_type` | enum(rep \| team) |  |  |
| `subject_id` | uuid |  | rep user_id or team id |
| `behavior_key` | text |  | → behaviors.key |
| `behavior_name` | text |  |  |
| `unit` | enum(ratio \| seconds \| per_call \| percent \| count) |  |  |
| `value` | numeric |  |  |
| `team_median` | numeric | yes |  |
| `team_size` | int | yes | reps on the subject's team for the period — team_median is shown only when >= 8 |
| `direction` | enum(improving \| regressing \| steady) |  |  |
| `confidence` | enum(low \| medium \| high) |  |  |
| `sample_size` | int |  |  |
| `series` | jsonb |  | last 4–12 weekly values, oldest first |
| `y_min` | numeric |  | FIXED per behavior — a steady rep looks steady |
| `y_max` | numeric |  |  |
| `period_start` | date |  |  |

RLS: select: org members; reps only subject_type='rep' AND subject_id = auth.uid()

Notes: Materialised weekly by a job over behavioral_events. PK (subject_type, subject_id, behavior_key, period_start).

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| rpc | `get_behavior_scores(p_subject_type, p_subject_id)` | { subject_type, subject_id } | BehaviorScoreRow[] (latest period) | JWT; rep may only pass their own id |

**Example row** (the contract test validates this against the column spec):

```json
{
  "subject_type": "rep",
  "subject_id": "u_jordan",
  "behavior_key": "pause_after_objection",
  "behavior_name": "Pause after objection",
  "unit": "seconds",
  "value": 0.4,
  "team_median": 1.3,
  "team_size": 9,
  "direction": "regressing",
  "confidence": "high",
  "sample_size": 41,
  "series": [
    0.9,
    0.7,
    0.6,
    0.4
  ],
  "y_min": 0,
  "y_max": 3,
  "period_start": "2026-09-28"
}
```

Mapper: `src/lib/data/behaviors/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-03.contract.test.ts`

<a id="c-04"></a>

### C-04 · Insight — headline + evidence + confidence + sample size

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day · Flow 3 · Pattern

**Screens:** `H1` `H2` `H3` `H4` `H5` `H6` `I1` `R1` `A11` `P2` `P5` `O3` `B2`

**Closes GAPS.md:** 05 feed item: insight → evidence → action; 05 confidence score; 05 sample size; 04 first insight; 08 insights

**View model the screens use** — `Insight` (`src/lib/data/types/insight.ts`):

```ts
export type Insight = {
  id: ID;
  kind: InsightKind;
  headline: string;
  body: string | null;
  confidence: Confidence;
  sampleSize: number;
  /** e.g. "6 objections · 4 calls" */
  sampleLabel: string | null;
  /**
   * Analyzed calls behind the insight — the rep's for a rep insight, the team's for a
   * team pattern. Gates rendering (CLAUDE.md §13.13): see `gateInsight`.
   */
  callsAnalyzed: number;
  affectedRepIds: ID[];
  evidence: EvidenceRef[];
  /** null when confidence is low — observation only. */
  action: InsightAction | null;
  /** The word "caused" may appear only when true. */
  causalTested: boolean;
  tone: SignalTone;
  tag: string | null;
  createdAt: ISODate;
};
```

**`insights`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `team_id` | uuid | yes | → teams.id |
| `kind` | enum(pattern \| regression \| improvement \| call \| coaching \| report) |  |  |
| `headline` | text |  | must pass the language rule; 'caused' only if causal_tested |
| `body` | text | yes |  |
| `confidence` | enum(low \| medium \| high) |  |  |
| `sample_n` | int |  | REQUIRED — never render an insight without it |
| `sample_label` | text | yes | e.g. 'n = 6 objections · 4 calls' |
| `calls_n` | int |  | analyzed calls behind it (rep's / team's). Rendered only if >= 10 rep / >= 50 team (CLAUDE.md §13.13) |
| `affected_rep_ids` | uuid[] |  |  |
| `evidence` | jsonb |  | [{ call_id, t_seconds, speaker, speaker_label, quote }] |
| `action_type` | enum(assign_coaching \| review_calls \| open_report \| open_behavior) | yes | null when confidence = low |
| `action_label` | text | yes |  |
| `action_target` | jsonb | yes | { repId, behaviorKey } | { callIds } | { reportId } |
| `causal_tested` | bool |  |  |
| `tone` | enum(improve \| regress \| attention \| info \| neutral) |  |  |
| `tag` | text | yes |  |
| `created_at` | timestamptz |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only — reps: only rows where affected_rep_ids = {auth.uid()}

Notes: CHECK (confidence <> 'low' OR action_type IS NULL). CHECK (causal_tested OR headline !~* '\mcaus').

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/insights?order=created_at.desc` | filters: kind, affected_rep_ids | InsightRow[] | JWT + RLS |
| edge | `generate-insights` | { org_id, since } | { ok, insights_written } | service role / cron |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "ins_1",
  "organization_id": "org_acme",
  "team_id": "team_mm",
  "kind": "regression",
  "headline": "Jordan lost control during 4 of 6 price objections this week.",
  "body": "He responds within half a second.",
  "confidence": "high",
  "sample_n": 6,
  "sample_label": "n = 6 objections · 4 calls",
  "calls_n": 41,
  "affected_rep_ids": [
    "u_jordan"
  ],
  "evidence": [
    {
      "call_id": "call_acme",
      "t_seconds": 1122,
      "speaker": "prospect",
      "speaker_label": "PROSPECT",
      "quote": "We already budgeted for another tool this year."
    }
  ],
  "action_type": "assign_coaching",
  "action_label": "Assign coaching",
  "action_target": {
    "repId": "u_jordan",
    "behaviorKey": "pause_after_objection"
  },
  "causal_tested": false,
  "tone": "regress",
  "tag": "↓ Regressing",
  "created_at": "2026-09-30T08:04:00Z"
}
```

Mapper: `src/lib/data/insights/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-04.contract.test.ts`

<a id="c-05"></a>

### C-05 · CoachingFocus — Focus · Evidence · Acknowledgement · Result

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day · Flow 3 · Pattern

**Screens:** `G2` `G3` `G4` `G5` `G6` `G7` `G8` `G9` `G11` `G12` `C6` `H4` `R1` `T5` `T11` `B4`

**Closes GAPS.md:** 05 coach queue; 05 before/after measurement window; 06 today's focus; 06 acknowledge coaching; 06 practice script; 09 coaching history per rep; 11 all four coaching objects

**View model the screens use** — `CoachingFocus` (`src/lib/data/types/coaching.ts`):

```ts
export type CoachingFocus = {
  id: ID;
  repId: ID;
  repName: string;
  behaviorKey: string;
  behaviorName: string;
  note: string;
  evidence: EvidenceRef[];
  metric: string;
  baseline: number;
  target: number;
  /** judge after N calls or on a date */
  judgeAfter: { calls: number | null; date: ISODate | null };
  status: CoachingStatus;
  result: CoachingResult | null;
  assignedById: ID;
  assignedAt: ISODate;
  acknowledgedAt: ISODate | null;
};
```

**`coaching_focuses`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `rep_id` | uuid |  | → auth.users.id |
| `rep_name` | text |  | denormalised for list views |
| `behavior_key` | text |  | → behaviors.key |
| `behavior_name` | text |  |  |
| `note` | text |  |  |
| `practice_script` | text | yes |  |
| `evidence` | jsonb |  | [{ call_id, t_seconds, speaker, speaker_label, quote }] |
| `metric` | text |  |  |
| `baseline` | numeric |  |  |
| `target` | numeric |  |  |
| `judge_after_calls` | int | yes |  |
| `judge_after_date` | timestamptz | yes |  |
| `status` | enum(assigned \| acknowledged \| measuring \| held \| not_yet \| reverted) |  |  |
| `result_value` | numeric | yes |  |
| `result_verdict` | enum(held \| not_yet \| reverted) | yes |  |
| `result_measured_on` | timestamptz | yes |  |
| `result_sample_size` | int | yes |  |
| `assigned_by` | uuid |  |  |
| `assigned_at` | timestamptz |  |  |
| `acknowledged_at` | timestamptz | yes |  |

RLS: select: is_org_member(organization_id, auth.uid()) AND (role <> 'rep' OR rep_id = auth.uid()) — reps read only their own rows

Notes: Status machine: assigned → acknowledged → measuring → held | not_yet | reverted. Result columns written only by the measure job.

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/coaching_focuses` | filters: rep_id, status | CoachingFocusRow[] | JWT + RLS |
| edge | `assign-coaching` | AssignCoachingInput { repId, behaviorKey, note, evidence, target, judgeAfterCalls } | CoachingFocusRow | JWT, manager/coach/admin/owner |
| edge | `acknowledge-coaching` | { focus_id } | CoachingFocusRow | JWT, the rep themself |
| edge | `measure-coaching` | { org_id } | { ok, measured } | service role / cron |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "cf_1",
  "organization_id": "org_acme",
  "rep_id": "u_jordan",
  "rep_name": "Jordan Reyes",
  "behavior_key": "pause_after_objection",
  "behavior_name": "Pause after objection",
  "note": "Pause · ask what's behind it · then answer.",
  "practice_script": null,
  "evidence": [
    {
      "call_id": "call_acme",
      "t_seconds": 1122,
      "speaker": "prospect",
      "speaker_label": "PROSPECT",
      "quote": "We already budgeted for another tool this year."
    }
  ],
  "metric": "seconds before responding to an objection",
  "baseline": 0.4,
  "target": 1.5,
  "judge_after_calls": 5,
  "judge_after_date": null,
  "status": "held",
  "result_value": 1.8,
  "result_verdict": "held",
  "result_measured_on": "2026-10-05T00:00:00Z",
  "result_sample_size": 5,
  "assigned_by": "u_dana",
  "assigned_at": "2026-09-29T10:00:00Z",
  "acknowledged_at": "2026-09-29T12:00:00Z"
}
```

Mapper: `src/lib/data/coaching/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-05.contract.test.ts`

<a id="c-06"></a>

### C-06 · Call V1 fields — coaching_value, stage_at_call, opportunity, account, type, status

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day

**Screens:** `C1` `C2` `C4` `C9` `H1` `H3` `T6` `T10` `R1`

**Closes GAPS.md:** calls.coaching_value (ranks C1/H1/H3); calls.stage_at_call; calls.opportunity_id; calls.account; calls.type; calls.status processing|ready|failed|partial; key moments count / top moment

**View model the screens use** — `Call` (`src/lib/data/types/call.ts`):

```ts
export type Call = {
  id: ID;
  repId: ID;
  repName: string;
  account: { id: ID | null; name: string };
  contactName: string | null;
  opportunityId: ID | null;
  startedAt: ISODate;
  durationSec: number;
  type: "discovery" | "demo" | "negotiation" | "follow_up" | "other";
  direction: "inbound" | "outbound" | null;
  /** Stage the deal was in when the call happened. */
  stageAtCall: string | null;
  outcome: CallOutcome | null;
  /** 0–100 — ranks Calls (C1) and Home (H1, H3). */
  coachingValue: number | null;
  status: CallStatus;
  keyMoments: number;
  topMoment: { label: string; tone: SignalTone; timestamp: string } | null;
  recordingUrl: string | null;
};
```

**`v_calls_v1`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `user_id` | uuid |  |  |
| `rep_name` | text |  | profiles.full_name |
| `account_id` | uuid | yes | NEW calls.account_id → customer_accounts / companies |
| `account_name` | text |  |  |
| `contact_name` | text | yes |  |
| `opportunity_id` | uuid | yes | NEW calls.opportunity_id (CRM deal) |
| `started_at` | timestamptz |  |  |
| `duration` | int |  |  |
| `direction` | enum(inbound \| outbound) | yes |  |
| `call_type` | enum(discovery \| demo \| negotiation \| follow_up \| other) |  | NEW calls.call_type |
| `stage_at_call` | text | yes | NEW calls.stage_at_call — deal stage when the call happened |
| `outcome` | enum(won \| lost \| advanced \| no_decision \| pending) | yes | back-filled from CRM |
| `coaching_value` | numeric | yes | NEW calls.coaching_value 0–100 |
| `status` | enum(processing \| ready \| failed \| partial) |  | derived: call_analysis_jobs + transcript presence |
| `key_moment_count` | int |  | count from behavioral_events / call_moments |
| `top_moment_label` | text | yes |  |
| `top_moment_tone` | enum(improve \| regress \| attention \| info \| neutral) | yes |  |
| `top_moment_t_seconds` | numeric | yes |  |
| `recording_url` | text | yes |  |

RLS: security_invoker view over calls (is_org_member) — reps: user_id = auth.uid()

Notes: ALTER TABLE calls ADD account_id, opportunity_id, call_type, stage_at_call, coaching_value. Frontend reads the view.

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/v_calls_v1?order=coaching_value.desc.nullslast` | filters: user_id, status, outcome, started_at | CallV1Row[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "call_acme",
  "organization_id": "org_acme",
  "user_id": "u_jordan",
  "rep_name": "Jordan Reyes",
  "account_id": "acct_acme",
  "account_name": "Acme Logistics",
  "contact_name": "David Park",
  "opportunity_id": "opp_acme",
  "started_at": "2026-09-28T14:00:00Z",
  "duration": 2280,
  "direction": "outbound",
  "call_type": "negotiation",
  "stage_at_call": "Pricing",
  "outcome": "pending",
  "coaching_value": 92,
  "status": "ready",
  "key_moment_count": 4,
  "top_moment_label": "Lost control 18:42",
  "top_moment_tone": "regress",
  "top_moment_t_seconds": 1122,
  "recording_url": null
}
```

Mapper: `src/lib/data/calls/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-06.contract.test.ts`

<a id="c-07"></a>

### C-07 · Home feed — ranked insights per tab + attention + coach queue

**Status:** Not started · **Unblocks:** Flow 1 · Manager day

**Screens:** `H1` `H2` `H3` `H4` `H5` `H6` `B2` `B10` `B11`

**Closes GAPS.md:** 05 feed item; 05 attention items (behavioral, not CRM deviation); 05 coach queue

**View model the screens use** — `FeedItem` (`src/lib/data/types/insight.ts`):

```ts
export type FeedItem = { id: ID; tab: HomeTab; insight: Insight };
```

**`get_home_feed`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `user_id` | uuid |  |  |
| `tab` | enum(for_you \| team_updates \| calls \| coaching \| reports \| mentions) |  |  |
| `rank` | int |  |  |
| `insight` | jsonb |  | an InsightRow (C-04) |

RLS: RPC, security definer; manager/coach/admin/owner/viewer only — never a rep

Notes: RPC returns { items: FeedItemRow[], attention: [{id,title,severity,href}], coach_queue: [{rep_id,rep_name,behavior_name,reason}] }.

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| rpc | `get_home_feed(p_tab)` | { tab: HomeTab | 'all' } | { items: FeedItemRow[], attention, coach_queue } | JWT, non-rep |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "f1",
  "user_id": "u_dana",
  "tab": "for_you",
  "rank": 1,
  "insight": {
    "id": "ins_1",
    "organization_id": "org_acme",
    "team_id": "team_mm",
    "kind": "regression",
    "headline": "Jordan lost control during 4 of 6 price objections this week.",
    "body": "He responds within half a second.",
    "confidence": "high",
    "sample_n": 6,
    "sample_label": "n = 6 objections · 4 calls",
    "calls_n": 41,
    "affected_rep_ids": [
      "u_jordan"
    ],
    "evidence": [
      {
        "call_id": "call_acme",
        "t_seconds": 1122,
        "speaker": "prospect",
        "speaker_label": "PROSPECT",
        "quote": "We already budgeted for another tool this year."
      }
    ],
    "action_type": "assign_coaching",
    "action_label": "Assign coaching",
    "action_target": {
      "repId": "u_jordan",
      "behaviorKey": "pause_after_objection"
    },
    "causal_tested": false,
    "tone": "regress",
    "tag": "↓ Regressing",
    "created_at": "2026-09-30T08:04:00Z"
  }
}
```

Mapper: `src/lib/data/insights/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-07.contract.test.ts`

<a id="c-08"></a>

### C-08 · Teams + team members

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 10 · Team

**Screens:** `T1` `T2` `T3` `T4` `T5` `T6` `T7` `E4` `H1` `shell rail + switcher`

**Closes GAPS.md:** 05 team rollup; 09 team object, team membership; 09 'Mid-Market AE team of 9'; 16 teams management

**View model the screens use** — `Team` (`src/lib/data/types/people.ts`):

```ts
export type Team = {
  id: ID;
  name: string;
  managerId: ID | null;
  repIds: ID[];
  status: "active" | "setup";
  callsThisWeek: number;
  analyzedCalls: number;
};
```

**`teams`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `name` | text |  |  |
| `manager_id` | uuid | yes |  |
| `status` | enum(active \| setup) |  |  |
| `rep_ids` | uuid[] |  | view column: array_agg(team_members.user_id) |
| `calls_this_week` | int |  | view column |
| `analyzed_calls` | int |  | view column |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; reps see only their own team row

**`team_members`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `team_id` | uuid |  | → teams.id |
| `user_id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `joined_at` | timestamptz |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/v_teams` | — | TeamRow[] | JWT + RLS |
| postgrest | `POST /rest/v1/teams · /team_members` | { name } · { team_id, user_id } | row | JWT, admin/owner |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "team_mm",
  "organization_id": "org_acme",
  "name": "Mid-Market AE",
  "manager_id": "u_dana",
  "status": "active",
  "rep_ids": [
    "u_jordan",
    "u_alex"
  ],
  "calls_this_week": 186,
  "analyzed_calls": 486
}
```

Mapper: `src/lib/data/team/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-08.contract.test.ts`

<a id="c-09"></a>

### C-09 · V1 roles — owner · admin · manager · rep · viewer · coach

**Status:** Not started · **Unblocks:** Flow 0 · Sign in · Flow 1 · Manager day · Flow 5 · Rep invite

**Screens:** `shell (role-aware nav)` `E3` `E5` `A5`

**Closes GAPS.md:** 06 rep must never see peer data — needs an authoritative rep role; 16 users, roles

**View model the screens use** — `Role` (`src/lib/data/types/session.ts`):

```ts
export type Role = "owner" | "admin" | "manager" | "rep" | "viewer" | "coach";
```

**`workspace_member_roles`** — alter existing table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `workspace_id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `user_id` | uuid |  |  |
| `role` | enum(owner \| admin \| manager \| rep \| viewer \| coach) |  | CHECK constraint on today's free-text column |
| `team_id` | uuid | yes | NEW — primary team |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admin/owner

Notes: Existing table (not in types.ts). Today role is free text default 'member'; the frontend treats anything else as least-privilege 'rep'.

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/workspace_member_roles?user_id=eq.{uid}` | user_id | WorkspaceRoleV1Row | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "workspace_id": "ws_acme",
  "organization_id": "org_acme",
  "user_id": "u_dana",
  "role": "manager",
  "team_id": "team_mm"
}
```

Mapper: `src/lib/data/session/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-09.contract.test.ts`

<a id="c-10"></a>

### C-10 · Call moments — labelled key moments with deep links

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day

**Screens:** `C3` `C4` `R3` `B3` `B6` `H3`

**Closes GAPS.md:** 07 moment player deep-link; 07 key moments

**View model the screens use** — `CallReview['moments'][number]` (`src/lib/data/types/call.ts`):

```ts
export type CallReview = {
  call: Call;
  transcript: TranscriptSegment[];
  analysis: CallAnalysis;
  events: BehavioralEvent[];
  moments: (EvidenceRef & { label: string; tone: SignalTone })[];
  coaching: CoachingFocus[];
};
```

**`call_moments`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `call_id` | uuid |  |  |
| `t_seconds` | numeric |  |  |
| `speaker` | enum(rep \| prospect \| other) |  |  |
| `speaker_label` | text |  |  |
| `quote` | text |  | transcript text at t_seconds |
| `label` | text |  | e.g. 'Lost control' |
| `tone` | enum(improve \| regress \| attention \| info \| neutral) |  |  |

RLS: security_invoker view over behavioral_events + call_transcripts

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/call_moments?call_id=eq.{id}` | call_id | CallMomentRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "call_id": "call_acme",
  "t_seconds": 1122,
  "speaker": "rep",
  "speaker_label": "Jordan Reyes",
  "quote": "Totally, and that's why we offer a discount—",
  "label": "Lost control",
  "tone": "regress"
}
```

Mapper: `src/lib/data/calls/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-10.contract.test.ts`

<a id="c-11"></a>

### C-11 · Coaching discussion comments

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day

**Screens:** `G10` `G6`

**Closes GAPS.md:** 11 coaching discussion

**View model the screens use** — `CoachingComment` (`src/lib/data/types/coaching.ts`):

```ts
export type CoachingComment = {
  id: ID;
  focusId: ID;
  authorId: ID;
  authorName: string;
  body: string;
  createdAt: ISODate;
};
```

**`coaching_comments`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `focus_id` | uuid |  | → coaching_focuses.id |
| `author_id` | uuid |  |  |
| `author_name` | text |  |  |
| `body` | text |  |  |
| `created_at` | timestamptz |  |  |

RLS: select/insert: the focus's rep, its assigner, and managers/coaches of the org

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · POST /rest/v1/coaching_comments?focus_id=eq.{id}` | { focus_id, body } | CoachingCommentRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "cc1",
  "focus_id": "cf_1",
  "author_id": "u_dana",
  "author_name": "Dana Whitfield",
  "body": "Try it on the Brightline follow-up first.",
  "created_at": "2026-09-29T12:30:00Z"
}
```

Mapper: `src/lib/data/coaching/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-11.contract.test.ts`

<a id="c-12"></a>

### C-12 · Methodology adherence per call

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 9 · Intelligence

**Screens:** `C5` `I8`

**Closes GAPS.md:** 07 methodology adherence per call; 08 Methodology adherence tab

**View model the screens use** — `CallAnalysis['methodologyAdherence'][number]` (`src/lib/data/types/call.ts`):

```ts
export type CallAnalysis = {
  summary: string | null;
  objections: CallObjection[];
  competitors: string[];
  nextSteps: string[];
  /** rep share of talk time, 0–1 */
  talkRatio: number | null;
  sentiment: number | null;
  /** per-stage adherence, 0–1. GAP until Methodology exists. */
  methodologyAdherence: { stage: string; score: number }[];
  analysisStatus: "queued" | "running" | "completed" | "failed" | "none";
  analysisVersion: number | null;
};
```

**`call_stage_scores`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `call_id` | uuid |  | → calls.id |
| `organization_id` | uuid |  |  |
| `methodology_id` | uuid |  | → methodologies.id |
| `stage_key` | text |  |  |
| `stage_name` | text |  |  |
| `score` | numeric |  | 0–1 |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only — reps: own calls only

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/call_stage_scores?call_id=eq.{id}` | call_id | CallStageScoreRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "call_id": "call_acme",
  "organization_id": "org_acme",
  "methodology_id": "meth_meddic",
  "stage_key": "pricing",
  "stage_name": "Pricing",
  "score": 0.3
}
```

Mapper: `src/lib/data/calls/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-12.contract.test.ts`

<a id="c-13"></a>

### C-13 · Briefs — daily / weekly, manager / rep / team / behavior

**Status:** Not started · **Unblocks:** Flow 1 · Manager day · Flow 2 · Rep day

**Screens:** `P1` `P2` `P3` `P4` `P5` `P6` `P7` `P8` `P9` `P10` `H5` `R1` `O8` `B1` `B2`

**Closes GAPS.md:** 06 60-second brief; 10 every brief; 12 #daily-brief room content

**View model the screens use** — `Brief` (`src/lib/data/types/report.ts`):

```ts
export type Brief = {
  id: ID;
  kind: BriefKind;
  title: string;
  /** "Wk 39", "September", "Mon 29 Sep" */
  period: string;
  subjectId: ID | null;
  generatedAt: ISODate;
  readMinutes: number;
  sections: BriefSection[];
};
```

**`briefs`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `kind` | enum(daily_manager \| daily_rep \| weekly_manager \| weekly_rep \| team \| behavior) |  |  |
| `title` | text |  |  |
| `period` | text |  | 'Wk 39', 'September', 'Tue 30 Sep' |
| `subject_id` | uuid | yes | rep / team / behavior the brief is about |
| `generated_at` | timestamptz |  |  |
| `read_minutes` | int |  |  |
| `sections` | jsonb |  | [{ heading, body, insights: InsightRow[] }] |

RLS: org members; reps only kind in (daily_rep, weekly_rep) AND subject_id = auth.uid()

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/briefs?order=generated_at.desc` | filters: kind, subject_id | BriefRow[] | JWT + RLS |
| edge | `generate-brief` | { org_id, kind, subject_id? } | BriefRow | service role / cron |
| edge | `render-brief` | { brief_id, channel: 'email' | 'push' | 'pdf' } | { url | html } | JWT |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "rep_weekly_39",
  "organization_id": "org_acme",
  "kind": "weekly_manager",
  "title": "Weekly Sales Behavior Report",
  "period": "Wk 39",
  "subject_id": "team_mm",
  "generated_at": "2026-09-29T07:00:00Z",
  "read_minutes": 5,
  "sections": [
    {
      "heading": "Patterns",
      "body": null,
      "insights": [
        {
          "id": "ins_1",
          "organization_id": "org_acme",
          "team_id": "team_mm",
          "kind": "regression",
          "headline": "Jordan lost control during 4 of 6 price objections this week.",
          "body": "He responds within half a second.",
          "confidence": "high",
          "sample_n": 6,
          "sample_label": "n = 6 objections · 4 calls",
          "calls_n": 41,
          "affected_rep_ids": [
            "u_jordan"
          ],
          "evidence": [
            {
              "call_id": "call_acme",
              "t_seconds": 1122,
              "speaker": "prospect",
              "speaker_label": "PROSPECT",
              "quote": "We already budgeted for another tool this year."
            }
          ],
          "action_type": "assign_coaching",
          "action_label": "Assign coaching",
          "action_target": {
            "repId": "u_jordan",
            "behaviorKey": "pause_after_objection"
          },
          "causal_tested": false,
          "tone": "regress",
          "tag": "↓ Regressing",
          "created_at": "2026-09-30T08:04:00Z"
        }
      ]
    }
  ]
}
```

Mapper: `src/lib/data/reports/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-13.contract.test.ts`

<a id="c-14"></a>

### C-14 · OutcomeAssociation — behavior × outcome (association only)

**Status:** Not started · **Unblocks:** Flow 3 · Pattern · Flow 9 · Intelligence

**Screens:** `I2` `I5` `I6` `I9`

**Closes GAPS.md:** 08 Behavior × Outcome matrix; 08 Behavioral Outcome Graph; 08 outcome patterns; n<30 suppression (Y3)

**View model the screens use** — `OutcomeAssociation` (`src/lib/data/types/outcome.ts`):

```ts
export type OutcomeAssociation = {
  behaviorKey: string;
  behaviorName: string;
  outcome: "won" | "lost" | "advanced" | "next_step_booked";
  withRate: number;
  withoutRate: number;
  nWith: number;
  nWithout: number;
  /** closed outcomes available — hide the association when < 30 (show Y3). */
  nClosed: number;
  confidence: Confidence;
  confounders: string[];
};
```

**`outcome_associations`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `organization_id` | uuid |  |  |
| `team_id` | uuid | yes |  |
| `behavior_key` | text |  |  |
| `behavior_name` | text |  |  |
| `outcome` | enum(won \| lost \| advanced \| next_step_booked) |  |  |
| `with_rate` | numeric |  |  |
| `without_rate` | numeric |  |  |
| `n_with` | int |  |  |
| `n_without` | int |  |  |
| `n_closed` | int |  | the UI hides the association below 30 |
| `confidence` | enum(low \| medium \| high) |  |  |
| `confounders` | text[] |  |  |
| `computed_at` | timestamptz |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; never a rep

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/outcome_associations?behavior_key=eq.{key}` | behavior_key? | OutcomeAssociationRow[] | JWT + RLS, non-rep |

**Example row** (the contract test validates this against the column spec):

```json
{
  "organization_id": "org_acme",
  "team_id": "team_mm",
  "behavior_key": "discovery_depth",
  "behavior_name": "Discovery depth",
  "outcome": "won",
  "with_rate": 0.41,
  "without_rate": 0.18,
  "n_with": 22,
  "n_without": 19,
  "n_closed": 41,
  "confidence": "medium",
  "confounders": [
    "deal size"
  ],
  "computed_at": "2026-09-29T00:00:00Z"
}
```

Mapper: `src/lib/data/outcomes/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-14.contract.test.ts`

<a id="c-15"></a>

### C-15 · Patterns — emerging team / rep / prospect / outcome / methodology patterns

**Status:** Not started · **Unblocks:** Flow 3 · Pattern · Flow 9 · Intelligence

**Screens:** `I1` `I3` `I7` `I8` `I9` `I10` `I11` `O3`

**Closes GAPS.md:** 08 Emerging Patterns; 08 the five Intelligence tabs

**View model the screens use** — `Pattern` (`src/lib/data/types/behavior.ts`):

```ts
export type Pattern = {
  id: ID;
  scope: "team" | "rep" | "prospect" | "outcome" | "methodology";
  headline: string;
  confidence: Confidence;
  sampleSize: number;
  firstSeenAt: string;
  behaviorKey: string | null;
  affectedRepIds: ID[];
  // Optional on purpose: the real table has none of these yet (F-1 in LANE_REQUESTS.md asks for them).
  /** GAP: lifecycle status — F-1 */
  status?: PatternStatus;
  /** GAP: the detection rule under the title, "Answers price objection < 1s, then discounts" — F-1 */
  rule?: string | null;
  /** GAP: context-panel values — F-1 */
  selected?: PatternSelected | null;
};
```

**`patterns`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `scope` | enum(team \| rep \| prospect \| outcome \| methodology) |  |  |
| `headline` | text |  |  |
| `confidence` | enum(low \| medium \| high) |  |  |
| `sample_size` | int |  | patterns start at ~50 calls per team |
| `first_seen_at` | date |  |  |
| `behavior_key` | text | yes |  |
| `affected_rep_ids` | uuid[] |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; never a rep

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/patterns?scope=eq.{scope}` | scope? | PatternRow[] | JWT + RLS, non-rep |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "pat_1",
  "organization_id": "org_acme",
  "scope": "team",
  "headline": "Reps answered before diagnosing in 7 of 9 price objections.",
  "confidence": "medium",
  "sample_size": 9,
  "first_seen_at": "2026-09-26",
  "behavior_key": "pause_after_objection",
  "affected_rep_ids": [
    "u_jordan"
  ]
}
```

Mapper: `src/lib/data/behaviors/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-15.contract.test.ts`

<a id="c-16"></a>

### C-16 · Workspace analysis progress

**Status:** Not started · **Unblocks:** Flow 4 · Sign up & connect

**Screens:** `A10` `A11` `Y2 (Home · Analysis processing)`

**Closes GAPS.md:** 04 analysis-initializing progress % (call_analysis_jobs is per-call)

**View model the screens use** — `OnboardingState['analysis']` (`src/lib/data/types/workspace.ts`):

```ts
export type OnboardingState = {
  step: "workspace" | "teach" | "connect" | "invite" | "analysis" | "first_insight" | "done";
  workspaceName: string | null;
  methodologyTemplate: string | null;
  connectedSources: string[];
  invitedCount: number;
  analysis: { analyzed: number; total: number; etaMinutes: number | null };
};
```

**`get_workspace_analysis_progress`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `workspace_id` | uuid |  |  |
| `analyzed` | int |  | count(call_analysis_jobs completed) |
| `total` | int |  | count(calls) |
| `eta_minutes` | int | yes |  |
| `first_insight_ready` | bool |  |  |

RLS: RPC, security invoker

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| rpc | `get_workspace_analysis_progress()` | — | AnalysisProgressRow | JWT |

**Example row** (the contract test validates this against the column spec):

```json
{
  "workspace_id": "ws_acme",
  "analyzed": 312,
  "total": 486,
  "eta_minutes": 14,
  "first_insight_ready": false
}
```

Mapper: `src/lib/data/onboarding/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-16.contract.test.ts`

<a id="c-17"></a>

### C-17 · Methodology — template, stages, behavior rules

**Status:** Not started · **Unblocks:** Flow 4 · Sign up & connect · Flow 12 · Settings

**Screens:** `A7` `E9` `E10` `E11` `E12` `I8`

**Closes GAPS.md:** 04 'teach Bylda how you sell' — stage definitions; 16 methodology index / stages / rules / rule editor

**View model the screens use** — `Methodology` (`src/lib/data/types/settings.ts`):

```ts
export type Methodology = {
  id: ID;
  name: string;
  template: "meddic" | "spin" | "challenger" | "sandler" | "bant" | "custom";
  stages: MethodologyStage[];
  behaviors: Behavior[];
  isActive: boolean;
};
```

**`methodologies`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `name` | text |  |  |
| `template` | enum(meddic \| spin \| challenger \| sandler \| bant \| custom) |  |  |
| `is_active` | bool |  |  |
| `stages` | jsonb |  | [{ key, name, order, exit_criteria[] }] — or a methodology_stages table |
| `behaviors` | jsonb |  | view: behaviors (C-02) where methodology_id = id |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admin/owner

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/v_methodologies` | — | MethodologyRow[] | JWT + RLS |
| edge | `apply-methodology-template` | { template } | MethodologyRow | JWT, admin (onboarding A7) |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "meth_meddic",
  "organization_id": "org_acme",
  "name": "MEDDIC — Mid-Market",
  "template": "meddic",
  "is_active": true,
  "stages": [
    {
      "key": "discovery",
      "name": "Discovery",
      "order": 1,
      "exit_criteria": []
    }
  ],
  "behaviors": []
}
```

Mapper: `src/lib/data/methodology/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-17.contract.test.ts`

<a id="c-18"></a>

### C-18 · Objection library

**Status:** Not started · **Unblocks:** Flow 4 · Sign up & connect · Flow 12 · Settings

**Screens:** `E13` `A7`

**Closes GAPS.md:** 16 objection library

**View model the screens use** — `ObjectionLibraryItem` (`src/lib/data/types/settings.ts`):

```ts
export type ObjectionLibraryItem = {
  id: ID;
  label: string;
  category: string;
  recommendedResponse: string;
  seenCount: number;
};
```

**`objection_library`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `label` | text |  |  |
| `category` | text |  |  |
| `recommended_response` | text |  |  |
| `seen_count` | int |  | view column over behavioral_events type=objection |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admin/owner

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · POST /rest/v1/objection_library` | { label, category, recommended_response } | ObjectionLibraryRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "ob1",
  "organization_id": "org_acme",
  "label": "Price / budget",
  "category": "Commercial",
  "recommended_response": "Pause, ask what's behind the number.",
  "seen_count": 23
}
```

Mapper: `src/lib/data/methodology/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-18.contract.test.ts`

<a id="c-19"></a>

### C-19 · Success criteria — which outcomes Bylda learns from

**Status:** Not started · **Unblocks:** Flow 4 · Sign up & connect · Flow 12 · Settings

**Screens:** `E14` `A7`

**Closes GAPS.md:** 16 success criteria (expected_outcomes is CRM-shaped)

**View model the screens use** — `SuccessCriterion` (`src/lib/data/types/settings.ts`):

```ts
export type SuccessCriterion = {
  id: ID;
  outcome: "next_step_booked" | "stage_advanced" | "closed_won_lost" | "meeting_held";
  enabled: boolean;
  source: "call" | "crm";
};
```

**`success_criteria`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `outcome` | enum(next_step_booked \| stage_advanced \| closed_won_lost \| meeting_held) |  |  |
| `enabled` | bool |  |  |
| `source` | enum(call \| crm) |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admin/owner

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · PATCH /rest/v1/success_criteria` | { enabled } | SuccessCriterionRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "sc1",
  "organization_id": "org_acme",
  "outcome": "next_step_booked",
  "enabled": true,
  "source": "call"
}
```

Mapper: `src/lib/data/methodology/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-19.contract.test.ts`

<a id="c-20"></a>

### C-20 · Data source sync stats — calls synced, waiting backlog, category

**Status:** Not started · **Unblocks:** Flow 4 · Sign up & connect · Flow 11 · Connections

**Screens:** `X1` `A8` `H7` `Y8`

**Closes GAPS.md:** 15 calls synced / waiting per source; Y8 'N calls waiting will backfill'

**View model the screens use** — `DataSource` (`src/lib/data/types/integration.ts`):

```ts
export type DataSource = {
  key: string;
  name: string;
  category: "recorder" | "dialer" | "crm" | "meetings";
  status: "connected" | "disconnected" | "error" | "not_connected";
  lastSyncAt: ISODate | null;
  callsSynced: number;
  waiting: number;
  error: string | null;
};
```

**`v_integration_sources`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `integration_key` | text |  |  |
| `name` | text |  |  |
| `category` | enum(recorder \| dialer \| crm \| meetings) |  |  |
| `status` | enum(connected \| disconnected \| error \| not_connected) |  |  |
| `last_sync_at` | timestamptz | yes |  |
| `calls_synced` | int |  |  |
| `waiting` | int |  |  |
| `last_error` | text | yes |  |

RLS: security_invoker over user_integrations_masked + integration_raw_objects counts

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/v_integration_sources` | — | IntegrationSourceRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "integration_key": "aircall",
  "name": "Aircall",
  "category": "dialer",
  "status": "error",
  "last_sync_at": "2026-09-27T12:00:00Z",
  "calls_synced": 74,
  "waiting": 23,
  "last_error": "The access token expired."
}
```

Mapper: `src/lib/data/integrations/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-20.contract.test.ts`

<a id="c-21"></a>

### C-21 · Delivery channels — Slack · Teams · email · push, separate from sources

**Status:** Not started · **Unblocks:** Flow 11 · Connections · Flow 12 · Settings

**Screens:** `X2` `E7`

**Closes GAPS.md:** 14 Slack/Teams delivery config; 15 delivery channels as a separate area (V1 decision 5)

**View model the screens use** — `DeliveryChannel` (`src/lib/data/types/integration.ts`):

```ts
export type DeliveryChannel = {
  key: "slack" | "teams" | "email" | "push";
  name: string;
  status: "connected" | "not_connected";
  destinations: string[];
};
```

**`delivery_channels`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `organization_id` | uuid |  |  |
| `key` | enum(slack \| teams \| email \| push) |  |  |
| `name` | text |  |  |
| `status` | enum(connected \| not_connected) |  |  |
| `destinations` | text[] |  | channels / addresses |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admin/owner. Disconnecting a channel never stops analysis.

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · PATCH /rest/v1/delivery_channels` | { destinations } | DeliveryChannelRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "organization_id": "org_acme",
  "key": "slack",
  "name": "Slack",
  "status": "connected",
  "destinations": [
    "#sales-leadership"
  ]
}
```

Mapper: `src/lib/data/integrations/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-21.contract.test.ts`

<a id="c-22"></a>

### C-22 · CRM field mapping (read-only)

**Status:** Not started · **Unblocks:** Flow 4 · Sign up & connect · Flow 11 · Connections

**Screens:** `X3` `A8`

**Closes GAPS.md:** 15 HubSpot field-mapping UI state

**View model the screens use** — `FieldMapping` (`src/lib/data/types/integration.ts`):

```ts
export type FieldMapping = {
  byldaField: string;
  crmObject: string;
  crmField: string | null;
  direction: "read";
  required: boolean;
};
```

**`integration_field_mappings`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `organization_id` | uuid |  |  |
| `integration_key` | text |  |  |
| `bylda_field` | text |  |  |
| `crm_object` | text |  |  |
| `crm_field` | text | yes |  |
| `required` | bool |  |  |

RLS: select: is_org_member(organization_id, auth.uid()); writes: service role / edge fn only; writes: admin/owner. Direction is always READ in V1 — Bylda never writes to the CRM.

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · PATCH /rest/v1/integration_field_mappings?integration_key=eq.{key}` | { crm_field } | FieldMappingRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "organization_id": "org_acme",
  "integration_key": "hubspot",
  "bylda_field": "Stage at call",
  "crm_object": "Deal",
  "crm_field": "dealstage",
  "required": true
}
```

Mapper: `src/lib/data/integrations/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-22.contract.test.ts`

<a id="c-23"></a>

### C-23 · Search — question → visible filters → calls (never answers from memory)

**Status:** Not started · **Unblocks:** Flow 8 · Ask & find

**Screens:** `S1` `S2` `S3` `B9` `Y12`

**Closes GAPS.md:** 13 call / behavior / pattern / coaching entities in the palette; 13 NL query over behavior data

**View model the screens use** — `SearchResponse` (`src/lib/data/types/search.ts`):

```ts
export type SearchResponse = {
  query: string;
  filters: SearchFilter[];
  results: SearchResult[];
  windowDays: number;
};
```

**`search-calls`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `query` | text |  |  |
| `window_days` | int |  |  |
| `filters` | jsonb |  | [{ field, value, label }] — shown as editable chips |
| `results` | jsonb |  | [{ call_id, title, rep_name, started_at, snippet, t_seconds, matched[] }] |

RLS: edge fn with the caller's JWT; reps get only their own calls

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| edge | `search-calls` | { query, window_days } | SearchResponseRow | JWT |
| rpc | `search_entities(q)` | { q } | PaletteItem[] | JWT; reps: no people/patterns |

**Example row** (the contract test validates this against the column spec):

```json
{
  "query": "price objections Jordan",
  "window_days": 30,
  "filters": [
    {
      "field": "rep",
      "value": "u_jordan",
      "label": "Jordan Reyes"
    }
  ],
  "results": [
    {
      "call_id": "call_acme",
      "title": "Jordan × Acme Logistics",
      "rep_name": "Jordan Reyes",
      "started_at": "2026-09-28T14:00:00Z",
      "snippet": "Lost control 18:42",
      "t_seconds": 1122,
      "matched": [
        "rep"
      ]
    }
  ]
}
```

Mapper: `src/lib/data/search/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-23.contract.test.ts`

<a id="c-24"></a>

### C-24 · Notifications — V1 types, severity, title/body, link

**Status:** Not started · **Unblocks:** Flow 8 · Ask & find

**Screens:** `N1` `N2` `B5` `shell bell dot`

**Closes GAPS.md:** 14 behavioral notification types; severity is a dot and a word

**View model the screens use** — `Notification` (`src/lib/data/types/notification.ts`):

```ts
export type Notification = {
  id: ID;
  type: NotificationType;
  /** "BEHAVIOR REGRESSION" */
  typeLabel: string;
  severity: "info" | "attention" | "regress" | "improve";
  title: string;
  body: string | null;
  href: string;
  read: boolean;
  createdAt: ISODate;
};
```

**`notifications`** — alter existing table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `user_id` | uuid |  |  |
| `organization_id` | uuid |  | NEW |
| `type` | enum(behavior_regression \| important_call \| emerging_pattern \| report_ready \| coaching_completed \| coaching_acknowledged \| methodology_breakdown \| integration_problem \| behavior_improvement) |  | constrain today's free-text type |
| `severity` | enum(info \| attention \| regress \| improve) |  | NEW |
| `title` | text |  | NEW (today: message) |
| `body` | text | yes | NEW |
| `href` | text |  | NEW — in-app link |
| `read` | bool |  |  |
| `created_at` | timestamptz |  |  |

RLS: user_id = auth.uid()

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · PATCH /rest/v1/notifications?user_id=eq.{uid}` | { read } | NotificationV1Row[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "n1",
  "user_id": "u_dana",
  "organization_id": "org_acme",
  "type": "behavior_regression",
  "severity": "regress",
  "title": "Jordan's pause dropped to 0.4s",
  "body": "4 of 6 price objections this week.",
  "href": "/app/intelligence/behaviors/pause_after_objection",
  "read": false,
  "created_at": "2026-09-30T08:04:00Z"
}
```

Mapper: `src/lib/data/notifications/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-24.contract.test.ts`

<a id="c-25"></a>

### C-25 · Objection stats — handled-well rate + weekly trend

**Status:** Not started · **Unblocks:** Flow 9 · Intelligence

**Screens:** `I4` `O3`

**Closes GAPS.md:** 08 objection view: handled well / trend (frequency is buildable today)

**View model the screens use** — `ObjectionStat` (`src/lib/data/types/behavior.ts`):

```ts
export type ObjectionStat = {
  label: string;
  count: number;
  callCount: number;
  handledWellRate: number | null;
  trend: Direction;
  sampleSize: number;
  confidence: Confidence;
};
```

**`get_objection_stats`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `label` | text |  |  |
| `count` | int |  |  |
| `call_count` | int |  |  |
| `handled_well_rate` | numeric | yes | needs behavioral_events (C-01) |
| `trend` | enum(improving \| regressing \| steady) |  |  |
| `sample_size` | int |  |  |
| `confidence` | enum(low \| medium \| high) |  |  |

RLS: RPC; non-rep

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| rpc | `get_objection_stats(p_days)` | { days } | ObjectionStatRow[] | JWT, non-rep |

**Example row** (the contract test validates this against the column spec):

```json
{
  "label": "Price / budget",
  "count": 23,
  "call_count": 17,
  "handled_well_rate": 0.35,
  "trend": "regressing",
  "sample_size": 23,
  "confidence": "high"
}
```

Mapper: `src/lib/data/behaviors/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-25.contract.test.ts`

<a id="c-26"></a>

### C-26 · Rep comparison — MANAGER-ONLY

**Status:** Not started · **Unblocks:** Flow 10 · Team

**Screens:** `T13`

**Closes GAPS.md:** 09 rep comparison on behavior

**View model the screens use** — `RepComparisonRow` (`src/lib/data/types/people.ts`):

```ts
export type RepComparisonRow = {
  behaviorKey: string;
  name: string;
  values: { repId: ID; value: number; n: number }[];
  teamMedian: number;
};
```

**`get_rep_comparison`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `behavior_key` | text |  |  |
| `behavior_name` | text |  |  |
| `team_median` | numeric |  |  |
| `values` | jsonb |  | [{ rep_id, value, n }] |

RLS: RPC, security definer; RAISE if the caller's role is rep

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| rpc | `get_rep_comparison(p_team_id)` | { team_id } | RepComparisonRow[] | JWT, manager/coach/admin/owner/viewer |

**Example row** (the contract test validates this against the column spec):

```json
{
  "behavior_key": "pause_after_objection",
  "behavior_name": "Pause after objection",
  "team_median": 1,
  "values": [
    {
      "rep_id": "u_jordan",
      "value": 0.4,
      "n": 38
    }
  ]
}
```

Mapper: `src/lib/data/team/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-26.contract.test.ts`

<a id="c-27"></a>

### C-27 · Workspace settings — timezone, analysis preferences, retention

**Status:** Not started · **Unblocks:** Flow 12 · Settings

**Screens:** `E1` `E6` `E8` `Y11`

**Closes GAPS.md:** 16 analysis preferences; 16 retention & privacy settings

**View model the screens use** — `AnalysisPreferences` (`src/lib/data/types/settings.ts`):

```ts
export type AnalysisPreferences = {
  minCallSeconds: number;
  excludeInternalCalls: boolean;
  languages: string[];
  redactPii: boolean;
};
```

**`workspace_settings`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `workspace_id` | uuid |  |  |
| `timezone` | text |  |  |
| `week_starts_on` | enum(monday \| sunday) |  |  |
| `min_call_seconds` | int |  |  |
| `exclude_internal_calls` | bool |  |  |
| `languages` | text[] |  |  |
| `redact_pii` | bool |  |  |
| `recordings_retention_days` | int |  |  |
| `transcripts_retention_days` | int |  |  |
| `delete_on_request` | bool |  |  |

RLS: org members read; admin/owner write

Notes: Also maps to RetentionPolicy (mapRetention).

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · PATCH /rest/v1/workspace_settings?workspace_id=eq.{id}` | partial row | SettingsRow | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "workspace_id": "ws_acme",
  "timezone": "America/New_York",
  "week_starts_on": "monday",
  "min_call_seconds": 120,
  "exclude_internal_calls": true,
  "languages": [
    "en"
  ],
  "redact_pii": true,
  "recordings_retention_days": 90,
  "transcripts_retention_days": 365,
  "delete_on_request": true
}
```

Mapper: `src/lib/data/settings/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-27.contract.test.ts`

<a id="c-28"></a>

### C-28 · Notification preferences (per user)

**Status:** Not started · **Unblocks:** Flow 12 · Settings

**Screens:** `E7`

**Closes GAPS.md:** 16 notifications settings

**View model the screens use** — `NotificationPreferences` (`src/lib/data/types/settings.ts`):

```ts
export type NotificationPreferences = {
  channel: "in_app" | "email" | "slack";
  types: Record<string, boolean>;
  quietHours: { from: string; to: string } | null;
};
```

**`notification_preferences`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `user_id` | uuid |  |  |
| `channel` | enum(in_app \| email \| slack) |  |  |
| `types` | jsonb |  | { [NotificationType]: boolean } |
| `quiet_from` | text | yes | '19:00' |
| `quiet_to` | text | yes |  |

RLS: user_id = auth.uid()

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · PATCH /rest/v1/notification_preferences` | partial row | NotificationPrefsRow | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "user_id": "u_dana",
  "channel": "slack",
  "types": {
    "behavior_regression": true,
    "report_ready": true,
    "integration_problem": true
  },
  "quiet_from": "19:00",
  "quiet_to": "08:00"
}
```

Mapper: `src/lib/data/settings/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-28.contract.test.ts`

<a id="c-29"></a>

### C-29 · API keys

**Status:** Not started · **Unblocks:** Flow 12 · Settings

**Screens:** `E17`

**Closes GAPS.md:** 16 API keys

**View model the screens use** — `ApiKey` (`src/lib/data/types/settings.ts`):

```ts
export type ApiKey = {
  id: ID;
  label: string;
  last4: string;
  createdAt: ISODate;
  lastUsedAt: ISODate | null;
  scopes: string[];
};
```

**`api_keys`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `label` | text |  |  |
| `last4` | text |  | hash stored server-side; secret shown once |
| `scopes` | text[] |  |  |
| `created_at` | timestamptz |  |  |
| `last_used_at` | timestamptz | yes |  |

RLS: admin/owner only

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| edge | `create-api-key` | { label, scopes } | { key (once), row: ApiKeyRow } | JWT, admin/owner |
| postgrest | `GET · DELETE /rest/v1/api_keys` | id | ApiKeyRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "key1",
  "organization_id": "org_acme",
  "label": "Data warehouse export",
  "last4": "9f2c",
  "scopes": [
    "calls.read"
  ],
  "created_at": "2026-08-02T00:00:00Z",
  "last_used_at": null
}
```

Mapper: `src/lib/data/settings/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-29.contract.test.ts`

<a id="c-30"></a>

### C-30 · Saved call views

**Status:** Not started · **Unblocks:** Flow 1 · Manager day (C1 entry)

**Screens:** `C1`

**Closes GAPS.md:** 07 saved views / filters (client-side fallback today)

**View model the screens use** — `SavedView` (`src/lib/data/types/call.ts`):

```ts
export type SavedView = { id: ID; name: string; filter: CallFilter; count: number };
```

**`saved_views`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `user_id` | uuid |  |  |
| `name` | text |  |  |
| `filter` | jsonb |  | CallFilter |
| `call_count` | int |  | view column |
| `created_at` | timestamptz |  |  |

RLS: user_id = auth.uid() (personal) or shared to the team

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · POST /rest/v1/saved_views` | { name, filter } | SavedViewRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "sv1",
  "organization_id": "org_acme",
  "user_id": "u_dana",
  "name": "Worth your time",
  "filter": {
    "teamId": "team_mm"
  },
  "call_count": 3,
  "created_at": "2026-09-01T00:00:00Z"
}
```

Mapper: `src/lib/data/calls/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-30.contract.test.ts`

<a id="c-31"></a>

### C-31 · Workspace health (owner home)

**Status:** Not started · **Unblocks:** Flow 0 · Sign in (owner lands on H7)

**Screens:** `H7`

**Closes GAPS.md:** 05 admin: org-scoped failed jobs, seats, weekly analyzed (health_checks is global today)

**View model the screens use** — `WorkspaceHealth` (`src/lib/data/types/workspace.ts`):

```ts
export type WorkspaceHealth = {
  sources: { key: string; name: string; status: "ok" | "degraded" | "down" }[];
  failedJobs: number;
  callsAnalyzedThisWeek: number;
  seats: { used: number; total: number | null };
  alerts: { id: ID; title: string; severity: "attention" | "regress" }[];
};
```

**`get_workspace_health`** — view / RPC result

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `sources` | jsonb |  | [{ key, name, status: ok|degraded|down }] |
| `failed_jobs` | int |  |  |
| `calls_analyzed_this_week` | int |  |  |
| `seats_used` | int |  |  |
| `seats_total` | int | yes |  |
| `alerts` | jsonb |  | [{ id, title, severity }] |

RLS: RPC; admin/owner

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| rpc | `get_workspace_health()` | — | WorkspaceHealthRow | JWT, admin/owner |

**Example row** (the contract test validates this against the column spec):

```json
{
  "sources": [
    {
      "key": "zoom",
      "name": "Zoom",
      "status": "ok"
    }
  ],
  "failed_jobs": 1,
  "calls_analyzed_this_week": 186,
  "seats_used": 14,
  "seats_total": 20,
  "alerts": [
    {
      "id": "al1",
      "title": "Aircall stopped syncing on Sep 27",
      "severity": "regress"
    }
  ]
}
```

Mapper: `src/lib/data/insights/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-31.contract.test.ts`

<a id="c-32"></a>

### C-32 · Seats on the subscription

**Status:** Not started · **Unblocks:** Flow 12 · Settings

**Screens:** `E15` `E16` `H7`

**Closes GAPS.md:** 16 billing: seats / seats used

**View model the screens use** — `Plan` (`src/lib/data/types/billing.ts`):

```ts
export type Plan = {
  tier: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  periodEnd: ISODate | null;
  seats: number | null;
  seatsUsed: number;
  cancelAtPeriodEnd: boolean;
};
```

**`subscriptions`** — alter existing table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `organization_id` | uuid |  |  |
| `plan` | text |  |  |
| `status` | enum(trialing \| active \| past_due \| canceled \| incomplete) |  |  |
| `current_period_end` | timestamptz | yes |  |
| `cancel_at_period_end` | bool |  |  |
| `seats` | int | yes | NEW — from Stripe quantity |
| `seats_used` | int |  | NEW — view column: active members |

RLS: existing subscriptions RLS

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/subscriptions?organization_id=eq.{org}` | org | SubscriptionV1Row | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "organization_id": "org_acme",
  "plan": "Scale",
  "status": "active",
  "current_period_end": "2026-10-31T00:00:00Z",
  "cancel_at_period_end": false,
  "seats": 20,
  "seats_used": 14
}
```

Mapper: `src/lib/data/billing/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-32.contract.test.ts`

<a id="c-33"></a>

### C-33 · Rooms

**Status:** Not started · **Unblocks:** Flow 6 · Rooms

**Screens:** `O1` `O2` `O7` `O8` `O9` `O10` `O11` `O14` `B7` `shell sidebar`

**Closes GAPS.md:** 12 rooms, room_members

**View model the screens use** — `Room` (`src/lib/data/types/room.ts`):

```ts
export type Room = {
  id: ID;
  slug: string;
  name: string;
  kind: RoomKind;
  topic: string;
  memberCount: number;
  unread: number;
  hasMention: boolean;
  isMember: boolean;
};
```

**`rooms`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `slug` | text |  |  |
| `name` | text |  |  |
| `kind` | enum(channel \| brief \| coaching \| team \| deal) |  |  |
| `topic` | text |  |  |
| `member_count` | int |  | view column |
| `unread_count` | int |  | view column, per viewer |
| `has_mention` | bool |  | view column, per viewer |
| `is_member` | bool |  | view column, per viewer |

RLS: members of the room (room_members) + org admins

Notes: Plus room_members(room_id, user_id, last_read_at). Realtime publication already exists (20260701000004).

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/v_rooms · POST /rooms` | { name, kind, topic } | RoomRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "room_objections",
  "organization_id": "org_acme",
  "slug": "objection-watch",
  "name": "objection-watch",
  "kind": "channel",
  "topic": "Objections Bylda is tracking.",
  "member_count": 12,
  "unread_count": 9,
  "has_mention": true,
  "is_member": true
}
```

Mapper: `src/lib/data/rooms/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-33.contract.test.ts`

<a id="c-34"></a>

### C-34 · Messages, threads, reactions

**Status:** Not started · **Unblocks:** Flow 6 · Rooms · Flow 7 · Messages

**Screens:** `O2` `O3` `O4` `O5` `O12` `O13` `B7` `B8` `H6 (mentions)`

**Closes GAPS.md:** 12 messages, threads; 05 mentions tab

**View model the screens use** — `Message` (`src/lib/data/types/room.ts`):

```ts
export type Message = {
  id: ID;
  roomId: ID | null;
  threadId: ID | null;
  authorId: ID;
  authorName: string;
  isApp: boolean;
  body: string;
  block: MessageBlock | null;
  reactions: Reaction[];
  replyCount: number;
  createdAt: ISODate;
};
```

**`messages`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `room_id` | uuid | yes |  |
| `thread_id` | uuid | yes | DM thread or reply thread |
| `author_id` | uuid |  |  |
| `author_name` | text |  |  |
| `is_app` | bool |  | posted by Bylda — renders the APP badge |
| `body` | text |  |  |
| `block` | jsonb | yes | MessageBlock union: report | call | coaching | structured | insight |
| `reactions` | jsonb |  | view column [{ symbol, count, mine }] |
| `reply_count` | int |  |  |
| `created_at` | timestamptz |  |  |

RLS: readers of the room / participants of the thread

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET · POST /rest/v1/messages?room_id=eq.{id}` | { body, block? } | MessageRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "m1",
  "room_id": "room_objections",
  "thread_id": null,
  "author_id": "bylda",
  "author_name": "Bylda",
  "is_app": true,
  "body": "Price objections handled early this week:",
  "block": {
    "type": "report",
    "title": "Weekly report",
    "meta": "Wk 39",
    "reportId": "rep_weekly_39"
  },
  "reactions": [
    {
      "symbol": "✓",
      "count": 2,
      "mine": true
    }
  ],
  "reply_count": 2,
  "created_at": "2026-09-30T08:10:00Z"
}
```

Mapper: `src/lib/data/rooms/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-34.contract.test.ts`

<a id="c-35"></a>

### C-35 · Direct-message threads (incl. BYLDA Coach DM)

**Status:** Not started · **Unblocks:** Flow 2 · Rep day (Coach DM) · Flow 7 · Messages

**Screens:** `O12` `O13` `B8` `B9` `shell sidebar`

**Closes GAPS.md:** 12 DMs, BYLDA Coach DM

**View model the screens use** — `DmThread` (`src/lib/data/types/room.ts`):

```ts
export type DmThread = {
  id: ID;
  title: string;
  participantIds: ID[];
  unread: number;
  isCoach: boolean;
};
```

**`dm_threads`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `organization_id` | uuid |  |  |
| `title` | text |  | view column — the other participant's name |
| `participant_ids` | uuid[] |  |  |
| `unread_count` | int |  |  |
| `is_coach` | bool |  |  |

RLS: participants only

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `GET /rest/v1/v_dm_threads` | — | DmThreadRow[] | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "dm_1",
  "organization_id": "org_acme",
  "title": "Jordan Reyes",
  "participant_ids": [
    "u_dana",
    "u_jordan"
  ],
  "unread_count": 2,
  "is_coach": false
}
```

Mapper: `src/lib/data/rooms/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-35.contract.test.ts`

<a id="c-36"></a>

### C-36 · Mobile push registration

**Status:** Not started · **Unblocks:** Flow 2 · Rep day (mobile)

**Screens:** `B1` `B2` `B4` `B5`

**Closes GAPS.md:** 14 mobile push registration

**View model the screens use** — `PushRegistration` (`src/lib/data/types/notification.ts`):

```ts
export type PushRegistration = {
  platform: "ios" | "android" | "web";
  enabled: boolean;
  registeredAt: ISODate | null;
};
```

**`push_subscriptions`** — new table

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid |  |  |
| `user_id` | uuid |  |  |
| `platform` | enum(ios \| android \| web) |  |  |
| `token` | text |  | never returned to other users |
| `enabled` | bool |  |  |
| `created_at` | timestamptz |  |  |

RLS: user_id = auth.uid()

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| postgrest | `POST · DELETE /rest/v1/push_subscriptions` | { platform, token } | PushSubscriptionRow | JWT + RLS |

**Example row** (the contract test validates this against the column spec):

```json
{
  "id": "push1",
  "user_id": "u_jordan",
  "platform": "ios",
  "token": "tok_x",
  "enabled": true,
  "created_at": "2026-09-30T00:00:00Z"
}
```

Mapper: `src/lib/data/notifications/map.ts` · Contract test: `src/lib/data/__tests__/contracts/C-36.contract.test.ts`

<a id="c-37"></a>

### C-37 · Call comparison — derived client-side (no backend)

**Status:** Derived — no backend · **Unblocks:** Flow 1 · Manager day (optional)

**Screens:** `C8`

**Closes GAPS.md:** 07 call comparison — derivable from two call_insights rows

**View model the screens use** — `CallComparison` (`src/lib/data/types/call.ts`):

```ts
export type CallComparison = {
  left: CallReview;
  right: CallReview;
  differences: { label: string; left: string; right: string }[];
};
```

**Endpoints**

| Kind | Name | Input | Output | Auth |
| --- | --- | --- | --- | --- |
| derived | `loadCallComparison(a, b)` | two call ids | CallComparison (built from two CallReviews) | same as C-06 |

Derived in `src/lib/data/calls/hooks.ts` · Contract test: `src/lib/data/__tests__/contracts/C-37.contract.test.ts`

<!-- CONTRACTS:END -->
