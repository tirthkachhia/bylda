# GAPS.md — data the V1 screens need vs. what the backend has

# ≈ 69% MISSING (by field) · 83% (by core object)

Counted by data field across V1 screen areas 04–18: **201 fields needed, 139
MISSING (69.2%), 62 AVAILABLE** — the sum of the per-area counts below
(04: 3/15 · 05: 15/18 · 06: 12/14 · 07: 7/22 · 08: 19/20 · 09: 14/16 · 10: 12/14 ·
11: 16/16 · 12: 18/18 · 13: 4/8 · 14: 4/8 · 15: 3/12 · 16: 12/20).
By core object: **5 of 6 Dev Handoff objects have no table (83%)**, and the sixth
is partial.

> Re-derived on this repo. The earlier headline (167 fields, 130 missing, 77.8%)
> did not match its own per-area table, which sums to 201 / 139. Every table
> this file calls MISSING was re-checked against all 106 migrations — none has
> appeared — and every table/RPC it calls AVAILABLE exists. The field counts per
> area are the earlier Figma read, not re-walked here.

That number is not a UI problem. The backend is a **CRM + founder-journey
platform**. Bylda V1 is a **behavioral intelligence product**. The entire
behavioral domain — the thing the product *is* — has no schema.

---

## The contract: 6 core objects, 1 partly exists

Dev Handoff (page 20, node `21:91`) names exactly six core data objects. Checked
against all 106 migrations with
`grep -riE "create table (if not exists )?(public\.)?<name>"`:

| Dev Handoff object | Backing today | Verdict |
| --- | --- | --- |
| **Call** | `calls` + `call_transcripts` + `call_insights` | **PARTIAL** — see below |
| **BehavioralEvent** | nothing | **MISSING — no table** |
| **Behavior** | nothing | **MISSING — no table** |
| **Insight** | nothing | **MISSING — no table** |
| **OutcomeAssociation** | nothing | **MISSING — no table** |
| **CoachingFocus** | nothing | **MISSING — no table** |

Dev Handoff on `BehavioralEvent`: *"The atomic layer. Everything above is computed
from events — keep them immutable and versioned by detector."* There is no atomic
layer. Five of six objects, and therefore five sixths of the product, are unbuilt.

**Call** is the one partial win, and it is missing three fields the screens use:

| Call field (Dev Handoff) | In `calls`? |
| --- | --- |
| `id`, `started_at`, `duration`, `outcome` | ✅ (`outcome_tag`) |
| `rep_id` | ✅ as `user_id` |
| `account` | ⚠️ only `contact_id` / `lead_id` FKs — no account name |
| `opportunity_id?` | ❌ |
| `type` | ⚠️ only `direction` (inbound/outbound) |
| `stage_at_call` | ❌ — needed by 08 Behavior × Outcome, 16 Methodology |
| `coaching_value` | ❌ — **drives ranking in Calls + Home**; blocks `C1`, `H1`, `H3` |
| `status(processing\|ready\|failed\|partial)` | ⚠️ `calls.status` is a *telephony* enum (`queued`…`voicemail`); `call_analysis_jobs` covers analysis separately. Different concept, same name. |

Also absent, needed for 09 and 12 respectively: `teams`/`team_members` (the
"Mid-Market AE team of 9" has nothing to map onto — `organization_members`,
`workspace_member_roles` and `territories` are not sales teams), and
`rooms`/`room_members`/`messages` (`conversations` and `bylda_conversations` are
**customer** messaging, not internal team rooms).

Also absent: `briefs` (10), `methodology` / `methodology_stages` /
`methodology_rules` / objection library / success criteria (16), `rep_metrics` (06, 09),
`delivery_channels` (15), `saved_views` (07).

Lane 6 is **mocks only** for exactly this reason. Lanes 1 and 3 are majority-mock.

---

## Evidence thresholds the backend must eventually support

From page 17 (`1:18`) — these are product rules, not UI copy:

- Patterns start at **~50 calls per team** (`19:6`).
- A rep's insights appear at **10 analyzed calls** (`19:19`).
- `OutcomeAssociation` needs **~30 calls with and without** the behavior, plus CRM
  outcomes; below that, render `Behavior · Insufficient data` (`19:30`).

Nothing computes any of these today.

## What *is* available

The call pipeline is real and usable. From
`supabase/migrations/20260719000006_crm_phase4_calling.sql` and
`20260809000001_vertical_call_intelligence.sql`:

**`calls`** — `id`, `organization_id`, `contact_id`, `lead_id`, `user_id`,
`direction` (`inbound`|`outbound`), `status` (`queued`|`ringing`|`in_progress`|
`completed`|`missed`|`voicemail`|`failed`), `duration`, `recording_url`,
`disposition`, `outcome_tag`, `from_number`, `to_number`, `provider`,
`provider_call_id`, `started_at`, `metadata` jsonb, `created_at`

**`call_transcripts`** — `call_id`, `organization_id`, `transcript_text`,
`speaker_segments` jsonb, `sentiment_score`, `created_at`

**`call_insights`** — `call_id` (unique), `organization_id`, `objections` jsonb,
`competitor_mentions` jsonb, `talk_ratio`, `next_steps_extracted` jsonb,
`summary`, `sales_profile`, `vertical_insights` jsonb, `crm_writeback_preview`
jsonb, `missing_required_fields` text[], `analysis_version`, `writeback_status`,
`writeback_result` jsonb, `writeback_error`, `approved_at`, `approved_by`,
`context_receipt`, `context_version`, `transcript_hash`, `created_at`

Plus `call_analysis_jobs`, `call_queues`, `dial_sessions`, `deviation_alerts`,
`bylda_events`, `bylda_actions`, `notifications`, `sales_baselines`,
`forecast_snapshots`, `observed_metrics`, `expected_outcomes`, `outcomes`.

⚠️ `calls`, `call_insights` and `call_transcripts` are **missing from
`src/integrations/supabase/types.ts`** (as are 13 other tables the frontend
queries — full list in `AUDIT.md` → "Tables read by the frontend"). Existing code casts around it
(`const db = supabase as any` in `src/routes/app.crm.calls.tsx`). Regenerating
types is a backend change and out of scope — hand-write these types in
`src/lib/data/types/` and tag them `// GAP: types.ts stale`.

---

## Per-area breakdown

### 04 — Onboarding & Auth · 15 fields · 20% missing

| Field | Status |
| --- | --- |
| email, password, session | AVAILABLE: `supabase.auth` |
| invite token, invited role | AVAILABLE: `team-invite` edge fn + `auth.invite.tsx` |
| workspace name, id | AVAILABLE: `workspaces.name`, `.id` |
| org id, owner | AVAILABLE: `organizations.id`, `.owner_id` |
| member role | AVAILABLE: `user_roles`, `workspace_member_roles`, `has_role()` |
| onboarding answers | AVAILABLE: `complete-onboarding` `{mode, answers}`, `onboarding_responses` |
| call source connection | AVAILABLE: `save-integration`, `user_integrations`, `integration-oauth-start` |
| sales methodology template | AVAILABLE (partial): `crm_intelligence_profiles`, `business_context` |
| **"teach Bylda how you sell" — stage definitions** | **MISSING: `methodology` table (stages, rules, success criteria)** |
| **analysis-initializing progress %** | **MISSING: no workspace-level analysis job; `call_analysis_jobs` is per-call** |
| **first insight** | **MISSING: depends on `behaviors` + `insights`** |

### 05 — Manager / Admin Home · 18 fields · 83% missing

| Field | Status |
| --- | --- |
| workspace name, member count | AVAILABLE: `workspaces`, `list_org_members()` |
| calls today / this week | AVAILABLE: `calls` filtered on `created_at` |
| **feed item: insight → evidence → action** | **MISSING: `insights` table** |
| **attention items** | **MISSING: `deviation_alerts` exists but is CRM deviation, not behavioral** |
| **coach queue** | **MISSING: `coaching_assignments`** |
| **behavior name + direction (improve/regress)** | **MISSING: `behaviors`** |
| **confidence score** | **MISSING — and it is mandatory on every insight per CLAUDE.md §4** |
| **sample size** | **MISSING — same** |
| **before/after measurement window** | **MISSING: no `behavior_change_results`** |
| **rep name on a feed item** | AVAILABLE: `profiles.full_name` via `calls.user_id` |
| **team rollup** | **MISSING: `teams`** |
| admin: workspace health, failed jobs | AVAILABLE: `health_checks`, `failed_jobs`, `pulse_logs` |
| admin: usage / quota | AVAILABLE: `usage_tracking`, `usage_events`, `quotas`, `get_org_entitlements()` |

### 06 — Rep · 14 fields · 86% missing

| Field | Status |
| --- | --- |
| my calls | AVAILABLE: `calls` where `user_id = auth.uid()` |
| my call insights | AVAILABLE: `call_insights` joined on my calls |
| **today's focus (one behavior)** | **MISSING: `coaching_assignments` + `behaviors`** |
| **60-second brief** | **MISSING: `briefs`** |
| **my strengths / leaks** | **MISSING: `behaviors` aggregated per rep** |
| **my progress over time** | **MISSING: `rep_metrics` time series** |
| **acknowledge coaching** | **MISSING: no acknowledgement object** |
| **practice script** | **MISSING** |
| ⚠️ rep must never see peer data | **Enforce in UI.** No backend guarantee — RLS on `calls` is `is_org_member(organization_id, …)`, which lets any member read **every** call in the org. Filter by `user_id` in `/lib/data` **and** hide peer surfaces. This is a UI-enforced rule, exactly as CLAUDE.md §4 says. |

### 07 — Calls · 22 fields · 32% missing — the best-supported area

| Field | Status |
| --- | --- |
| call list, direction, status, duration, started_at | AVAILABLE: `calls.*` |
| recording URL / audio | AVAILABLE: `calls.recording_url` |
| disposition, outcome tag | AVAILABLE: `calls.disposition`, `.outcome_tag` |
| contact / lead / rep | AVAILABLE: `calls.contact_id`, `.lead_id`, `.user_id` |
| transcript + speaker split | AVAILABLE: `call_transcripts.transcript_text`, `.speaker_segments` |
| sentiment | AVAILABLE: `call_transcripts.sentiment_score` |
| objections, competitors | AVAILABLE: `call_insights.objections`, `.competitor_mentions` |
| talk ratio | AVAILABLE: `call_insights.talk_ratio` |
| summary, next steps | AVAILABLE: `call_insights.summary`, `.next_steps_extracted` |
| analysis status | AVAILABLE: `call_analysis_jobs`, `call_insights.analysis_version` |
| manual upload | AVAILABLE: `get-call-ingest-url` edge fn |
| re-analyse | AVAILABLE: `analyze-call` `{call_id}` |
| saved views / filters | AVAILABLE (client-side): no `saved_views` table — persist in localStorage or mock |
| **behavioral event timeline on the waveform** | **MISSING: `behavioral_events` with timestamps. `speaker_segments` gives turns, not behaviors.** |
| **moment player deep-link** | **MISSING: depends on behavioral event offsets** |
| **call comparison** | **MISSING: derivable client-side from two `call_insights` rows — mock the diff** |
| **methodology adherence per call** | **MISSING: `methodology`** |

### 08 — Intelligence · 20 fields · 95% missing

Only `calls` volume and `call_insights.objections` frequency are derivable.
Behavior Detail, Intelligence Home, Emerging Patterns, Objection view,
Behavior × Outcome matrix, Behavioral Outcome Graph, and the five Intelligence
tabs (Team behaviors · Methodology adherence · Outcome patterns · Rep patterns ·
Prospect patterns) are **MISSING: `behaviors`, `patterns`, `methodology`,
plus confidence and sample-size fields on every one.**

An objection **frequency** view is buildable today by aggregating
`call_insights.objections` jsonb client-side. That is the one real Intelligence
screen available. Everything else is mocked.

Type gaps the mocks can't carry without new fields (2026-10-06, tagged `// GAP:` in
`src/lib/data/mocks/intelligence.ts`):

| Frame | Drawn | Gap |
| --- | --- | --- |
| `I7` 51:1420 | BEST "Dana's team" on Recap before pricing | `BehaviorDetail.byRep` holds reps only; the fixture's best rep is Priya |
| `I7` 51:1420 | "Luis" in the pause distribution | the fixture's ninth Mid-Market rep is Leo Park (`u_leo`) |
| `I9` 51:1819 | BEHAVIOR ↔ OUTCOME table: behavior seen in won vs lost (79% / 43%, …) | no type: `OutcomeAssociation` is outcome rate with vs without, and I5 disagrees with these numbers; not mocked |
| `I9` 51:1819 | hero "19 won · 23 lost" label, eyebrows, OUTCOMES IN SCOPE (Won 19 · Lost 23 · Advanced 41 · Stalled 6 · Open 88) | no field / no type |
| `I11` 51:2556 | hero sentence "When a CFO joins…" separate from the "CFO on the call" row | `Pattern` has one headline; a separate row would be a sixth table row |
| `I11` 51:2556 | "PROSPECT PATTERN · CFOs" eyebrow, BY PERSONA (CFO, Ops lead, IT, VP Sales) | no field / no type, and no n or confidence drawn for personas |

### 09 — Team · 16 fields · 88% missing

| Field | Status |
| --- | --- |
| member list, names, avatars | AVAILABLE: `list_org_members()`, `profiles`, `user_profiles` view |
| role per member | AVAILABLE: `user_roles`, `workspace_member_roles`, `has_role()` |
| calls per rep | AVAILABLE: aggregate `calls` by `user_id` |
| **team object, team membership** | **MISSING: `teams`, `team_members`** |
| **behaviors heatmap per rep** | **MISSING: `behaviors`** |
| **rep comparison on behavior** | **MISSING** |
| **coaching history per rep** | **MISSING** |
| **team-level trend** | **MISSING** |
| **"Mid-Market AE team of 9" fixture** | **MISSING — mock it; there is no team concept to seed** |

### 10 — Reports · 14 fields · 86% missing

`weekly_reviews`, `client_reports` and `org_briefings` exist but are
Launchpad/CRM reports, not behavioral briefs. Daily Manager Brief, Daily Rep
Brief, email version, Weekly Manager/Rep Report, Team/Behavior report and PDF
export are **MISSING: `briefs` + everything behavioral upstream.**
Email delivery is AVAILABLE as a mechanism: `send-email` edge fn.

### 11 — Coaching · 16 fields · 100% missing

All four V1 coaching objects are absent: **Focus, Evidence, Acknowledgement,
Result.** `mentor_insights` is written by `analyze-call` on risk and is the
nearest signal, but it is a text insight, not an assignable coaching object with
an acknowledgement and a measured result. **MISSING: `coaching_assignments`,
`coaching_acknowledgements`, `behavior_change_results`.**

### 12 — Rooms & Messages · 18 fields · 100% missing

`conversations`, `bylda_conversations` and `receive-message` are
**customer** messaging (inbound SMS/email to leads), not internal team rooms.
Rooms directory, `#daily-brief`, `#coaching`, `#objection-watch`,
`#mid-market-team`, `#acme-logistics` deal room, DMs, BYLDA Coach DM, threads on
insights, room tabs (Insights · Calls · Reports · Files · About), new-room modal:
**MISSING: `rooms`, `room_members`, `messages`, `threads`.**
**Lane 6 is mocks only.** Realtime exists (`20260701000004_realtime_publication.sql`)
if rooms are ever built.

### 13 — Search & Ask · 8 fields · 50% missing

| Field | Status |
| --- | --- |
| contact search | AVAILABLE: `search_contacts()` RPC |
| lead search | AVAILABLE: `search_leads()` RPC |
| semantic search | AVAILABLE: `match_documents()` RPC + `context_embeddings` (pgvector) |
| ask-Bylda answer | AVAILABLE (repurposed): `bylda-chat`, `operator`, `memory-query` |
| **call / behavior / pattern / coaching entities in the palette** | **MISSING: no unified search across V1 entities; behaviors and patterns do not exist** |
| **NL query over behavior data** | **MISSING** |

### 14 — Notifications · 8 fields · 50% missing

`notifications` table + `send-email` exist. **MISSING:** behavioral notification
*types* (behavior regressed, coaching assigned, pattern emerged), Slack/Teams
delivery config (no `delivery_channels` table), mobile push registration.

### 15 — Integrations · 12 fields · 25% missing

Strong. AVAILABLE: `user_integrations`, `user_integrations_masked` view,
`integration_oauth_states`, `integration_external_objects`,
`integration_raw_objects`, `get_user_integration()` / `set_user_integration()`,
and edge fns `integration-oauth-start`, `integration-oauth-callback`,
`save-integration`, `sync-crm`, `sync-salesforce`, `sync-gohighlevel` (exists
but no frontend call today),
`get-call-ingest-url`, `get-inbound-url` `{org_id}` → `{configured, url?}`.
**MISSING:** HubSpot field-mapping UI state, and **delivery channels as a separate
area** (V1 architecture decision 5) — no `delivery_channels` table.

### 16 — Settings + Methodology · 20 fields · 60% missing

| Field | Status |
| --- | --- |
| profile, name, avatar | AVAILABLE: `profiles`, `user_profiles` |
| users, roles, permissions | AVAILABLE: `user_roles`, `roles`, `role_permissions`, `has_permission()` |
| billing, plan, invoices | AVAILABLE: `subscriptions`, `plan_tier_limits`, `feature_entitlements`, `list-invoices`, `manage-subscription`, `create-checkout` |
| audit log | AVAILABLE: `admin_audit_log`, `audit_log` |
| usage | AVAILABLE: `usage_tracking`, `usage_events` |
| **teams management** | **MISSING: `teams`** |
| **methodology index / stages / rules / rule editor** | **MISSING: `methodology`, `methodology_stages`, `methodology_rules`** |
| **objection library** | **MISSING** |
| **success criteria** | **MISSING: `expected_outcomes` is close but CRM-shaped** |
| **analysis preferences** | **MISSING** |
| **retention & privacy settings** | **MISSING** |
| **API keys** | **MISSING** |

### 17 — Empty & System States · 0 data fields

No backend need. Every state derives from a `/lib/data` hook's
`{loading, error, empty}`. **Build first** — lanes 1–6 all depend on these.

### 18 — Mobile & Responsive · 0 new fields

Same data, narrower layout. No new backend need.

---

## Every MISSING item has a backend contract

`BACKEND_BACKLOG.md` → *Contracts* (37, C-01…C-37) covers every item marked MISSING above,
ordered by the demo flow it unblocks — each with the view model, proposed table/columns,
endpoint and a Vitest contract test. The backend is built from those.

## Rules for filling a gap

1. Type it in `src/lib/data/types/` — shaped how the real table *should* look,
   not how a mock is convenient.
2. Fixture it in `src/lib/data/mocks/`, behind `VITE_BYLDA_MOCKS` — a few rows, enough to render the screen and its states.
3. Tag every mock `// GAP: <what backend would need>` on the line above.
4. Add a row here under the right area **and a contract in `BACKEND_BACKLOG.md`** (with its contract test).
5. Never invent a number in a component. Never `fetch` in a component.

Fixture, used by every mock so screens compose: **Acme Revenue** workspace ·
**Kiran Patel** owner · **Dana Whitfield** manager · **Mid-Market AE** team of 9 ·
**Jordan Reyes** rep · **#acme-logistics** deal room.

---

## Top 5 to escalate

1. **`BehavioralEvent` — the atomic layer has no table.** Dev Handoff is explicit
   that every other object is computed from it. Blocks 05, 06, 08, 09, 11 — 46 of
   128 views (7 + 3 + 11 + 13 + 12 per `FRAMES.md`), 56 counting 10 Reports. Nothing else on this list matters until this is decided.
2. **`Behavior` + `Insight`** — no tables. `Insight` carries the `confidence` and
   `sample_n` that CLAUDE.md §4 and the `Confidence` component (`4:66`) make
   mandatory on screen. Every insight surface is blocked on where these are computed.
3. **`CoachingFocus`** — no table. Area 11 is 12 views, 100% missing, and it is the
   "did it work?" half of the manager's job that the product exists for. Needs the
   full status machine: `assigned → acknowledged → measuring → held | not_yet | reverted`.
4. **`OutcomeAssociation`** — no table. Without it 08 has no matrix, no outcome
   patterns, no Behavioral Outcome Graph, and the n<30 suppression rule has nothing
   to suppress.
5. **`calls.coaching_value` + `stage_at_call`, and the stale `types.ts`.** Cheapest
   items on the list. `coaching_value` drives ranking on `C1`/`H1`/`H3`; without it
   Calls and Home cannot order anything. And `calls`, `call_insights`,
   `call_transcripts` are absent from the generated types although the tables exist,
   so the one well-supported area (07, 32% missing) still needs hand-written types.
   (Top 5 unchanged on re-check: no behavioral, coaching, team, room, brief or
   methodology table exists in any of the 106 migrations.)
