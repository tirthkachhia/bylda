# Launchpad Frontend Audit — Onboarding → Casefile → School → Home

Date: 2026-07-21 · Branch: `claude/launchpad-frontend-audit-vj5tr0`

Audit-first per the master prompt. **No implementation yet.** This report answers every
Part 1–3 question against the real code, proposes the smallest fix per gap, and — critically —
maps Part 3's requested `modules`/`module_steps` onto the systems that already exist so we
**extend, not fork**.

---

## TL;DR — the one thing to get right first

There are already **three overlapping "course/module" systems** in the repo. Part 3 must land
on the _live_ one and treat the other two as history:

| System                   | Tables / source                                                     | Status                                                                                                             | Casefile-personalized?                | Feeds `bylda_events` / `useProgressSpine`?                  |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------- |
| **Mission spine** (LIVE) | `missions` → `mission_steps` + `src/lib/step-execution-guidance.ts` | **Canonical.** Seeded at onboarding (`missionSeeds.ts`), advanced by `advance-mission`, read by `useProgressSpine` | Partially (seeded from lane/stage)    | **Yes** — `step.completed` / `mission.completed` dual-write |
| Mentor curriculum        | `playbooks` → `playbook_lessons` + `mentors`                        | **RETIRED** — `generate-playbook` returns HTTP 410 `CURRICULUM_RETIRED`; `use-curriculum.ts` is read-only history  | Was (from casefile_run)               | No                                                          |
| Academy                  | `src/lib/academy-modules.ts` (hard-coded) → `/app/academy`          | Live but **generic/static**; completion derived from `tool_runs`                                                   | **No** — same curriculum for everyone | No                                                          |

**Recommendation:** Part 3's `modules`/`module_steps` should be implemented as an **extension of
`missions`/`mission_steps`** (module = mission, step = mission_step), generated from the approved
casefile, owned per-mentor via the existing `mentors` roster + `assignMentor()`. Do **not** create
new `modules`/`module_steps` tables (that would be a 4th parallel system), and do **not** revive
`playbooks`. `useProgressSpine` already exposes the exact `mission → steps → nextStep → percent`
shape a course view needs; it needs one nesting extension (a list of missions, not just the
current one), not a replacement.

---

## PART 1 — Onboarding / Create-a-Business flow

Files: `src/routes/onboarding.tsx`, `src/components/app/ByldaIntakeChat.tsx`,
`src/constants/onboarding-questions.ts`.

The flow is: `detect` (3 signal chips) → `resolveMode()` → `chat` (Founder or Operator intake) →
`provisioning` (`complete-onboarding` edge fn) → `done`. Answers persist per-step to
`onboarding_sessions` (resume works). This is a solid spine — most of the "one thing at a time"
philosophy is already honored. Findings against the eight questions:

**1. Does it ever ask the user to type before showing a draft answer? — YES (3 instances).**
All free-text questions are blank fields with only a placeholder, no suggested draft:

- `FOUNDER_QUESTIONS[0]` `idea` — "Describe your idea in a sentence or two…" (`onboarding-questions.ts:84`)
- `OPERATOR_QUESTIONS[0]` `business_name` (`:288`)
- `OPERATOR_QUESTIONS[1]` `business_description` — "what does it do, and for whom?" (`:296`)

  Every other question is chip-select (draft-by-default — the user confirms, never composes).
  Only these three violate "Launchpad drafts, user confirms." _Smallest fix:_ see §1-Fix.

**2. More than one question per screen? — NO.** `ByldaIntakeChat` renders exactly one `currentQ`
at `step` (`ByldaIntakeChat.tsx:141,185-206`). ✔

**3. More than one primary path per screen? — NO.** Single-select chips auto-advance; text has one
submit arrow; multi-select has one "Continue" button (`ByldaIntakeChat.tsx:412-505`). ✔

**4. Persistent "you are here" progress path (idea→validate→launch→operate)? — NO.** Onboarding
shows only a thin **numeric** progress bar (`% = step/total`, `ByldaIntakeChat.tsx:142,156-175`).
There is no named stage spine. (Note: the _named_ stage stepper exists — but only later, inside
`MissionHero` on `/app/mission-control:532-571` — so the pattern is in the design system, just
absent from onboarding.) _Smallest fix:_ see §4-Fix.

**5. Does every step end in exactly one obvious next action? — YES.** ✔

**6. Idle-user fallback ("not sure? tap here and I'll do it")? — NO.** There is no
"I'm not sure — decide for me" affordance on any step. (The `monetization` question has a
_"Not sure yet"_ chip, `:198`, but that's one question's option, not a global escape hatch, and
the three text fields have no skip/do-it-for-me at all.) _Smallest fix:_ see §6-Fix.

**7. Voice input on every open-text field? — NO.** `TextInput` (`ByldaIntakeChat.tsx:313-389`) is a
plain textarea + submit; no mic. (Voice/`SpeechRecognition` exists elsewhere in the app —
`AiOperator.tsx`, `app.launchpad.$tool.tsx` — so there's a pattern to reuse, but it is not wired
into intake.) _Smallest fix:_ see §7-Fix.

**8. Does it conclude by producing a Founder Casefile, and does a draft/approved state exist? —
PARTIALLY / NO.** The "Founder Casefile" is **not a stored, approvable artifact**. It is a
_render layer_: `casefile-layouts.tsx` + `casefile.ts` map a `tool_run` output (e.g.
`validate-idea`) into shapes; `CasefileSummary.tsx` derives a live verdict from the
`BusinessGraph`. There is **no `status: draft|approved` column** and no approval gate anywhere
(`grep` for casefile approval returns only unrelated CRM `approval_requests`). Onboarding ends by
provisioning a workspace + first mission, not by producing an approvable casefile. This is the
central gap for Part 3's trigger (see §Part 3).

### Proposed smallest fixes (Part 1), none of which restructure the intake data model

All fixes are additive props/branches on `ByldaIntakeChat` + `onboarding-questions.ts`; answer keys,
`onboarding_sessions` shape, and `complete-onboarding` inputs stay identical.

- **§1-Fix (draft-before-type):** add an optional `draftHint`/`suggested` to the three `text`
  questions. For `idea`/`business_description`, render a **"✨ Draft it for me"** button above the
  textarea that pre-fills a Bylda-written starter the user then edits (a light client stub now; a
  `draft-intake-field` edge call later). The textarea still submits the same string key — zero model
  change. For `business_name`, offer 2–3 generated name chips + "type my own." _Layer: component +
  constants only._
- **§4-Fix (progress path):** replace the numeric bar with the existing 4-cell stage stepper grammar
  (idea → validate → launch → operate) already implemented in `MissionHero`. Map intake `step` →
  stage bucket and highlight "you are here." Extract that stepper into a shared
  `StageSpine` component so onboarding and mission-control share one. _Layer: component (shared)._
- **§6-Fix (idle fallback):** add a persistent, low-emphasis **"Not sure — let Bylda pick a strong
  default →"** link under every question that fills the recommended answer (chips: the modal/most
  common option; text: the drafted starter) and advances. Uses the existing `submitAnswer()` path.
  _Layer: component only._
- **§7-Fix (voice):** add a mic button inside `TextInput` using the `SpeechRecognition` pattern
  already in the codebase, transcribing into the same `textValue`. Feature-detect; hide where
  unsupported. _Layer: component only._

Item **8** is not a "small fix" — it is a schema + trigger decision covered in Part 3.

---

## PART 2 — Launchpad Home UX (vs GHL / Salesforce / Shopify)

Files: `src/routes/app.mission-control.tsx` (founder home), `src/routes/app.bylda-home.tsx`
(operator/bylda home), `src/components/bylda/*`, `src/components/app/dashboard/*`.

**1. Next-best-action inline on every screen, or in a separate panel? — INLINE on the homes;
INCONSISTENT elsewhere.** `mission-control` computes one `hero` move (blocker → top rec →
continue) and renders it as the dominant `MissionHero` with a single CTA
(`mission-control.tsx:82-110,161-168`) — this is best-in-class and beats GHL's widget grid.
But NBA is **re-derived per surface** (`MissionHero`, `NextStepHero`, `CrmNextBestAction`,
`next-best-action` edge fn) rather than one shared component, so most _inner_ routes
(research, automations, CRM subpages) have no inline "do this next." _Gap: NBA present on homes,
absent on inner tool routes._

**2. One universal search across contacts / casefiles / mentor convos / tasks? — NO (siloed).**
The cmdk primitive exists (`src/components/ui/command.tsx`) but is **not wired as a global
palette anywhere** — `bylda-home`'s "Command hero" is just a heading, not search
(`bylda-home.tsx:119`). Each module has its own local filter (contacts, companies, CRM). There is
no ⌘K. _Gap: no cross-entity search._

**3. Do AI outputs render as purpose-built layouts per type, or generic text? — PURPOSE-BUILT
(strong).** `casefile-layouts.tsx` + `casefile.ts` route seven semantic shapes
(`score_verdict`, `comparison`, `report`, `memo`, `plan_with_steps`, `pipeline_snapshot`,
`session_summary`) to bespoke layouts; `mentors.ts` owns a format per mentor. This already
matches the ask — no gap, keep and reuse for Part 3 step outputs. ✔

**4. Are advanced modules hidden for Starter-stage users, or always visible? — PARTIALLY GATED.**
Entitlements/feature-gating exist (`use-entitlements.ts`, `use-feature-gate.ts`,
`ModuleBoundary`) and `SUPPORT_TOOLS` is a fixed 6-tile set, but the full sidebar/route surface
(automation builder, deep CRM) is **stage-agnostic** — a Starter (Idea-stage) founder can still
navigate to the automation builder and deep CRM fields. Gating is by _plan entitlement_, not by
_stage_. _Gap: no stage-based progressive disclosure._

**5. Is momentum celebrated in the moment, or only in background data? — MOSTLY IN-THE-MOMENT
(good, uneven).** `MomentumRail` (collapsed by default), `PostRunMomentum`, XP/level/streak
tiles, `HexLevelBadge`, `XPProgressBar` all exist and fire after tool runs. But on
`mission-control` momentum is **collapsed/quiet** and step-completion in the intake/course has no
immediate celebratory beat. _Gap: completion moments under-celebrated at the exact instant._

### Proposed smallest fixes (Part 2) + ship-safety vs the in-flight CRM write-path

> Anything reading `contacts`/`companies` is flagged **CRM-dependent** and should wait for /ride
> behind the CRM write-path work. Everything else is **safe to ship independently.**

| Gap                                   | Smallest fix                                                                                                                                                                                       | Layer                    | Safe to ship independent of CRM work?                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| NBA not on inner routes               | Extract the `mission-control` hero logic into a shared `<NextBestAction/>` and drop it into inner route headers (reads `useProgressSpine` + `graph.blockers/recommendations`, which already exist) | Component (shared)       | **Yes** — reads spine/graph, not raw CRM tables                                        |
| No universal search                   | Wire a ⌘K `CommandDialog` over the existing cmdk primitive; **phase 1** = casefiles (`tool_runs`), missions/steps, mentor routes (all non-CRM). Add contacts/tasks in phase 2                      | Route/layout + component | **Phase 1 yes**; contacts/tasks results **CRM-dependent** → gate behind the write-path |
| Advanced modules always visible       | Add a `stageVisible(stage)` predicate to sidebar/nav items so Idea/Validate hide automation-builder & deep-CRM until Launch/Operate; reuse `useProgressSpine().stage`                              | Nav/layer config         | **Yes** — hiding is stage-driven, no CRM reads                                         |
| Momentum not celebrated in the moment | Reuse `PostRunMomentum` beat on every `step.completed` (toast + XP tick + streak flash)                                                                                                            | Component                | **Yes** — driven by `bylda_events`/spine                                               |
| AI output layouts                     | none — already purpose-built                                                                                                                                                                       | —                        | ✔                                                                                      |

---

## PART 3 — Founder Casefile → School Modules (post-approval course)

### Where Part 3 must plug in (extend, don't fork)

Part 3's data model (`modules` / `module_steps` with `completion_event → bylda_events`) is, field
for field, the **mission spine that already exists**:

| Part 3 asks for                                                                                   | Already exists as                                                                                                                               | Notes                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules(title, mentor_owner, order_index, unlock_condition, generated_from_casefile_id, status)` | `missions(title, sort_order, status, workspace_id)`                                                                                             | Missing: `mentor_owner`, `generated_from_casefile_id`, explicit `unlock_condition`, `locked` status. **Add these columns to `missions`** rather than a new table. |
| `module_steps(instruction, target_ui_ref, action_type, completion_event, status)`                 | `mission_steps(title, description, tool_key, status, sort_order)` + `step-execution-guidance.ts` (mentor-voice instruction keyed by `tool_key`) | Missing: `target_ui_ref`, `action_type`, explicit `completion_event`. **Add these columns to `mission_steps`.**                                                   |
| "dual-writes to `bylda_events` using the same pattern as `step.completed`/`mission.completed`"    | **Already implemented** in `advance-mission/index.ts:284-299` (`step.completed`) and `:325-340` (`mission.completed`)                           | No parallel tracker needed — extend the existing dual-write.                                                                                                      |
| "Extend `useProgressSpine` to support nested module → step"                                       | `useProgressSpine` returns the _current_ mission + its steps                                                                                    | Needs one addition: expose the **ordered list of missions** (locked/active/complete) so a vertical course path can render, not just the active mission.           |
| mentor ownership (Maya=offer, Alex=GTM…)                                                          | `mentors` table + `MENTOR_ROSTER` + `assignMentor(stage, format)` in `mentors.ts`                                                               | Reuse verbatim to set `missions.mentor_owner`.                                                                                                                    |

### The missing prerequisite: casefile approval state (blocks the generation trigger)

The generation trigger ("on Founder Casefile approval, fire a generation job") **cannot exist yet**
because there is no approval state (Part 1, Q8). Minimal path:

1. Treat the founder's Investment Assessment `tool_run` (the `score_verdict` casefile —
   `isAcceptableCasefile()` in `mentors.ts:214` already names this) as the casefile of record.
2. Add an **approval record**: smallest option is a `casefile_status` (`draft` | `approved`) +
   `approved_at` on that `tool_run`, or a tiny `founder_casefile(org_id, tool_run_id, status,
approved_at)` row. Prefer the column — no new top-level entity.
3. The existing casefile layout gets a single primary **"Approve & build my course"** CTA (honors
   "one primary action per screen"). Approving flips the status and fires the job.

### Generation job (server) — reuse, don't rebuild

- New edge fn (or un-retire the _concept_, not the tables, of `generate-playbook`) named e.g.
  `generate-course`: reads the approved casefile (idea, ICP, offer, stage/track) → produces an
  **ordered set of `missions`** (each with `mentor_owner` from `assignMentor`, a real `tool_key` per
  step, `target_ui_ref`, `action_type`, `completion_event`) → inserts into `missions`/`mission_steps`
  with the first module `active`, the rest `locked`. Starter (Idea) gets a shorter foundational set;
  Operator starts further in (reuse the `resolveMode`/stage the intake already computed and the
  `missionSeeds.ts` seeding pattern).
- Every step **must** reference a real clickable action — enforce that `tool_key`/`target_ui_ref`
  resolves to an existing route/component at generation time (validate against the route table),
  so no "nothing to click" steps ship.

### Frontend requirements — status vs the codebase

1. **Single vertical path, one module active, rest locked/greyed** — the `MissionHero` stage
   stepper (`mission-control.tsx:532-571`) already renders done/current/locked cells; needs to be
   generalized to a full-height course view reading the (new) ordered-missions list from the spine.
2. **One step at a time, full-width, one instruction, one button; step 3 hidden until step 2
   complete** — matches the `ByldaIntakeChat` single-`step` pattern and James Rivera's "current step
   is the only step" voice; needs a `CourseStep` view gated on `mission_steps.status`.
3. **Literal click guidance (spotlight/coachmark + auto-scroll)** — **does not exist yet.** This is
   the one genuinely new piece: a `Coachmark`/`Spotlight` component that reads `target_ui_ref`,
   scrolls to and highlights the real element. New component + a small ref-registry so steps can
   point at live UI.
4. **Every step completion shows imm[ediate feedback]** — the prompt is truncated here, but the beat
   already exists (`PostRunMomentum`, XP tick, `step.completed` event). Wire it to course steps.

---

## What I recommend we do next (awaiting your go-ahead)

Per the master prompt's "Report findings before implementing / STOP" instruction, I've stopped here.
Suggested build order, smallest-blast-radius first — all **safe to ship independent of the CRM
write-path** except where noted:

1. **Part 1 quick wins** (voice, idle fallback, draft-it-for-me on 3 text fields, shared StageSpine
   in onboarding) — pure component/constants, no schema change.
2. **Casefile approval state** (`casefile_status` column + "Approve & build my course" CTA) — the
   prerequisite that unblocks Part 3.
3. **Part 3 generation + course view** as an _extension of `missions`/`mission_steps`_ (add columns:
   `mentor_owner`, `generated_from_casefile_id`, `unlock_condition`, `target_ui_ref`, `action_type`,
   `completion_event`; `locked` status), `generate-course` edge fn, `useProgressSpine` nested list,
   `CourseView` + `CourseStep` + `Coachmark`.
4. **Part 2 shared NBA + ⌘K (non-CRM phase 1) + stage-gated nav + in-the-moment celebration.**

Open questions for you before I implement:

- Confirm the **extend-`missions` (not new `modules` tables)** decision — this is the load-bearing
  call and reverses the literal table names in the prompt in favor of "don't build parallel systems."
- Casefile approval: **column on the assessment `tool_run`** vs a small `founder_casefile` table —
  I recommend the column.
- Scope for this pass: do you want all four groups, or Part 1 + the approval-state prerequisite first?
