# Launchpad Bylda — Platform Audit & Redesign Blueprint

**Version 1.0 · 2026-06-10 · Audit basis: full codebase at commit `0c120e7`**

This document is the execution blueprint for redesigning Launchpad Bylda into a unified, guided, premium AI business operating system. Every finding cites real files in this repository. It is written to be handed to a designer, frontend engineer, product manager, and backend engineer.

---

## 1. EXECUTIVE SUMMARY

Bylda's conceptual core is genuinely strong and already encoded in the codebase: a closed value loop ("founder enters idea → Bylda assigns mission → completes it with AI tools → measurable progress", `src/constants/product-flow.ts:32`), four user lanes (`src/lib/lane-classifier.ts`), a mission system (`supabase/functions/provision-workspace`, `advance-mission`), plan-tiered model routing (PAL, `supabase/functions/_shared/pal/index.ts`), and a memory layer (`memory_artifacts`, `saveToMemory.ts`).

**The problem is that the surface has drifted away from the core.** Execution sprawl has produced:

- **65 routes and 5 competing command surfaces** (`/app/dashboard`, `/app/ai-dashboard`, `/app/command-center`, `/app/mission-control`, `/app/launch-control`) plus 3 CRM surfaces (`/app/contacts`, `/app/leads`, `/app/bylda/crm` + `bylda/leads`), 2 automations areas, and an entire orphaned `/app/scale/*` and `/app/bylda-os` branch.
- **A flat 32-tool library** where the catalog (`src/lib/catalog.ts`) and the runner (`app.launchpad.$tool.tsx`, 2,185 lines) treat every tool as an isolated form → output transaction.
- **AI context amnesia**: tools average **5.4/10 context specificity**. The memory system exists but **no tool prompt ever reads it**; handoffs pass the user's raw input string, not prior outputs (`src/lib/handoffs.ts`); the "workspace profile" injected into tools is 5 fields stored in **localStorage** (`src/lib/workspaceProfile.ts`).
- **One-size onboarding**: a single 6-question chat flow with zero branching, no founder/operator distinction, no mid-flow persistence, and a fragile client-orchestrated 8-step completion chain (`src/routes/onboarding.tsx:47-193`).
- **10 concrete reliability breakpoints**, headlined by silent Stripe webhook failures, missing RLS on `credit_ledger` and 7 other tables, no transaction around workspace provisioning, and frontend edge calls with no timeout/error handling.

**Redesign direction:** collapse the surface to **7 primary destinations** organized around the operating loop; split onboarding into **Create a Business** and **Operate a Business** tracks that both write to a single canonical **Business Context Graph**; convert the tool library into **outcome engines embedded in missions and playbooks**; make every AI call read and write that context graph through one shared context assembler; and harden the 10 reliability points with minimal, surgical fixes — no backend rewrite.

---

## 2. PLATFORM GOAL

**What Bylda is:** an AI-native business operating system that takes a user from idea → launch → operations → automation → scale. It is mission control, not a tool marketplace.

**Who it is for (two primary modes, one system):**

1. **Creators (founders)** — from raw idea through validation, offer, first customers, and launch. They need a guided path, ruthless validation, and assets generated in sequence.
2. **Operators** — running an existing business. They need visibility (KPIs), leverage (automations), systems (CRM/pipeline/SOPs), and scale recommendations.

**How it should operate (the operating contract):**

- **One brain**: a single Business Context Graph that every page, tool, and AI call reads from and writes to.
- **One loop**: every session answers "where am I, what's the highest-leverage next action, do it, record the result." The dashboard is the loop's cockpit, not a widget wall.
- **Tools serve outcomes**: a user never "browses tools"; they pursue an outcome ("validate my idea", "get 10 customers", "automate follow-up") and Bylda selects and sequences the tools.
- **AI as operating layer**: Bylda (chat/operator) is ambient — rail + command palette + embedded assistants — not a destination page.
- **Closed loop**: every tool run, mission step, CRM event, and automation result feeds the context graph and changes what Bylda recommends next.

---

## 3. CORE AUDIT FINDINGS

### 3.1 Navigation

- **9 nav groups, ~25 nav items** in `AppSidebar.tsx` (647 lines), with section labels (Build/Operate/Automate/Monitoring/Help) that don't match the groups beneath them.
- "Command" → `/app/dashboard`, but `/app/command-center` also exists and isn't in the nav. "Operate" group's first child is "Command Center" pointing at a _different_ page than the topbar title "Command Center" (which maps `/app/dashboard` in `PAGE_TITLES`). Users cannot build a mental model.
- Dead/unreachable routes: `/app/command-center`, `/app/bylda-full` (853 lines), `/app/bylda-os/*`, `/app/scale/*` (6 routes), `/app/blog/*`, `/app/galaxy` (443 lines), `/app/activity`.
- Mobile tab bar (Home, Launchpad, Contacts, Automate, Settings) implies a 5-item IA the desktop nav doesn't honor.

### 3.2 Information architecture

- Three vocabularies coexist: spatial metaphor (Galaxy, Mission Control, Launch Control, Launchpad), business vocabulary (CRM, Pipeline, Campaigns, Reports), and product-internal vocabulary (Bylda OS, Bylda Full, Intelligence).
- The same entity appears under multiple roots: leads live at `/app/leads`, `/app/bylda/leads`, and inside `/app/bylda/crm`; automations at `/app/automations` and `/app/scale/automations`; reports at `/app/bylda/reports` and `/app/scale/reports`.
- Education content is scattered: `/app/playbook` (1,122 lines), `/app/academy`, `/app/tutorials` (793), `/app/sop-library`, `/app/blog`.

### 3.3 Dashboard

- `/app/dashboard` (1,317 lines) stacks **9+ modules vertically** (health ring, stage tracker, CurrentMissionCard, WhatNextCard, SetupChecklistCard, YourPathCard, LaunchAssetsCard, playbook accordion with a 476-line inline data object, AskOperatorCard, AutomationStatusCard). It is a feed, not a cockpit — no hierarchy of "the one thing to do now."
- A second AI-generated dashboard exists at `/app/ai-dashboard` (1,069 lines) rendering the `ai_dashboards` payload (headline, risks, KPIs, quick wins, roadmap). The richest personalization in the product is hidden on a secondary page and **generated once at onboarding, never refreshed**.
- Health score is hardcoded client math (tool runs ≥1/5/15, leads ≥1/5...), unrelated to the AI dashboard's "north star metric."

### 3.4 Onboarding

- Single path, 6 questions, chip-based (`ByldaChatOnboarding.tsx`, 572 lines; an unused parallel `OnboardingWizard.tsx`, 560 lines, also exists).
- No founder/operator branch; an operator with $50k MRR answers "what's the business idea you're working on?"
- No per-step persistence — close the tab at question 5, lose everything.
- Completion is a **client-orchestrated chain** (`onboarding.tsx:47-193`): org insert → lane classify → `provision-workspace` (failure swallowed) → `onboarding_responses` upsert (non-fatal) → `workspace_intake` upsert (skipped if provisioning failed) → profile flag (only blocking step) → fire-and-forget `generate-ai-dashboard` + `log-activation-event` → 3.2s timed redirect. Any mid-chain failure produces a "successfully onboarded" user with an empty workspace.
- Data is duplicated across `onboarding_responses` and `workspace_intake` with renamed fields (`idea` stored as `offer`); no single source of truth.

### 3.5 Tool sprawl

- 22 tools formally cataloged + **10 more defined only in the runner's `TOOL_FIELDS`** with no plan tier/phase metadata; near-duplicates exist (`business-plan-generator` vs `business-plan`, `niche-scorer` vs `niche-validator`, `ad-copy` vs `ad-creative`, `pricing-calculator` vs `pricing`, `seo-audit` vs `analyze-website`).
- The hub (`app.launchpad.index.tsx`) is a filterable grid — a library, not a path. Progressive disclosure rules exist (`FIRST_RUN_VISIBLE_TOOLS` in `product-flow.ts`) but are the only gesture toward guidance.
- Mission steps deep-link to tools but **pass no context**; the tool opens blank except for the 5-field localStorage profile.

### 3.6 Page consistency

- Good foundations: shared paddings, `WorkspaceHeader`, `EmptyState`/`ErrorState` components, tokenized theme.
- But: monolith pages (OutputRenderer 5,333 lines; bylda.crm 3,189; mentor 2,260; $tool 2,185) each reinvent layout; card styling mixes inline `style={{}}` and Tailwind utilities; Mentor/Memory/Monitoring lack error states; no shared PageShell primitive.

### 3.7 AI specificity

- System prompts are excellent (BYLDA_PREFIX + expert personas + strict output formats in `run-tool/index.ts`). User prompts are 3–4 raw fields. **No tool reads `memory_artifacts`, prior `tool_runs`, `onboarding_responses`, or the org record.**
- `analyze-website` is fully context-blind (HTML only). `bylda-chat` injects org fields + 50 artifact previews **unbounded** (token overflow risk) while `run-tool` injects nothing — inverted priorities.
- The feedback loop (`feedback-loop` function, every 30 min) detects dissatisfaction (re-runs) and writes suggestions to `prompt_feedback` that nothing consumes.

### 3.8 Reliability / technical risk (top 10, evidence in §11)

1. `payments-webhook` silent failures → paid users stuck on old plan (CRITICAL).
2. Quota check race: read-then-increment in `_shared/helpers.ts:82-92` (CRITICAL).
3. No RLS on `credit_ledger`, `operator_memory`, `tool_outputs`, `support_tickets`, `n8n_error_log`, `user_ai_config`, `automation_drafts`, `client_kpi_metrics` (CRITICAL).
4. `provision-workspace` multi-insert without transaction → half-provisioned workspaces (HIGH).
5. `analyze-website` fetch without timeout/size cap (HIGH).
6. `bylda-chat` unbounded context block (HIGH).
7. Frontend fetches to edge functions without error handling/timeout (`IntelligenceRail.tsx`, `ByldaChatModal.tsx`, `AskOperatorCard.tsx`) (HIGH).
8. Wildcard CORS on all functions (`_shared/security.ts`) (MEDIUM).
9. Duplicated AI chat backends: Supabase `bylda-chat` vs Cloudflare worker `bylda-ai-api`; duplicated provisioning: edge function vs `N8N/bylda_ops_provision_workspace_setup.json`; 4 n8n ops workflows reference tables that don't exist (`users`, `user_entitlements`, `user_credits`, `user_profiles`) (MEDIUM).
10. `INTEGRATIONS_ENCRYPTION_KEY` falls back to the service-role key (`save-integration`) (MEDIUM).

---

## 4. FRONTEND / UI / UX AUDIT

**Layout system.** Shell = `AppSidebar` (collapsible 56/240px) + `AppTopbar` (breadcrumb/theme/user/rail toggle) + `ByldaBar` + `IntelligenceRail` (360px bottom panel) + `MobileTabBar`. The shell is solid; the problem is what's plugged into it. Verdict: keep the shell skeleton, replace the nav model and add a standard `PageShell` (header / toolbar / content grid / right-rail slots).

**Hierarchy.** Pages are vertical stacks of equal-weight cards. Nothing says "this is the one thing that matters." Fix: every primary page gets a **focus slot** (1 hero module) + **support grid** (2-col max) + **archive zone** (collapsed accordions).

**Density & spacing.** Consistent paddings (`px-5 py-5 md:px-7 md:py-6`), tokenized radii/shadows — good. Density is too low on dashboard (9 full-width cards ≈ 6 screens of scroll) and too high inside CRM kanban. Fix: 12-col grid with module size classes (S/M/L), max 2 screens for Home.

**Visual consistency.** Tokens are genuinely good (violet primary, surface scale, Cabinet Grotesk/Satoshi/JetBrains Mono, glow shadows). Violations: inline `style={{ background: "var(--surface)" }}` mixed with `bg-surface`; per-page accent colors invented ad hoc; landing page uses a blue system disconnected from the app's violet. Fix: ban inline color styles via lint rule; codify accent assignment (one accent per domain: Build=violet, Customers=cyan, Automate=amber, Insights=blue, Bylda=pink).

**Interaction model.** Cmd-K palette exists (`CommandPalette.tsx`, 9 pages + 18 tools) — underpowered but the right instinct. The Intelligence Rail can emit clickable tool chips (`[→ TOOL: slug | label]`) — this is the seed of the action-oriented AI pattern; standardize it as the universal "AI proposes → user accepts" affordance.

**Mobile.** Tab bar exists (Home, Launchpad, Contacts, Automate, Settings) but desktop-only pages like CRM kanban and Builder are unusable on mobile. Fix: mobile = monitor + approve + chat (Home, Bylda, Customers list, Approvals); editing surfaces stay desktop.

**Empty states.** `EmptyState` component is good and used in CRM/launchpad/memory. Missing where it matters most: `/app/ai-dashboard` when generation failed (currently silently empty — looks broken), missions absent after failed provisioning, Mentor/Memory/Monitoring.

**Loading states.** Skeletons + `Loader2` spinners exist; route-level loaders are not used (`ensureQueryData` pattern absent), so pages waterfall-fetch on mount.

**Error states.** `ErrorState` (6 variants incl. rate_limit → billing link) is excellent and underused. Chat surfaces (`IntelligenceRail`, `ByldaChatModal`, `AskOperatorCard`) parse `resp.json()` with no `resp.ok` check — a 500 yields a JS error and a dead panel.

---

## 5. PAGE-BY-PAGE AUDIT

Format per page: **Purpose · Wrong now · Change · Ideal layout · Interaction model · Key modules · Remove/deprioritize.**

### 5.1 Landing `/` (941 lines)

- **Purpose**: convert visitors; set the "AI business OS" expectation.
- **Wrong**: cinematic GSAP scroll-jacking (5 pinned sections, letter-by-letter animation, "STOP JUGGLING.") sells drama, not an OS; blue palette disconnected from app violet; heavy GSAP loaded eagerly; dark-only.
- **Change**: keep one hero animation beat, then show the actual product: a live-ish mock of Home with mission + AI output. Two CTAs mirroring onboarding: "Start a business" / "Run my business".
- **Layout**: hero (product mock right, claim left) → 3 outcome rows (validate / customers / automate) with real screenshots → pricing strip → CTA.
- **Interaction**: scroll-normal; one scroll-triggered product zoom max.
- **Modules**: hero, outcome rows, social proof, pricing, FAQ.
- **Remove**: typewriter/flash section, crack overlay, 290% pinned scroll.

### 5.2 Auth `/auth/*` (65–80 lines each)

- **Purpose**: frictionless entry.
- **Wrong**: two parallel signup routes (`/signup` with plan selection + org/subscription creation; `/auth/sign-up` bare). Divergent side effects = divergent bugs (org created at signup OR at onboarding).
- **Change**: one signup (`/auth/sign-up`); plan selection moves to billing/paywall moments; org creation moves entirely into the onboarding completion function (§11). `/signup` becomes a redirect.
- **Layout/modules**: keep AuthShell 2-col. Add OAuth providers. Footer states "2-minute setup, personalized to your business."

### 5.3 Onboarding `/onboarding` (517 + 572 + 560 lines)

- **Purpose**: capture the context graph seed; route to the right mode; provision the workspace.
- **Wrong**: single path; no persistence; duplicated wizard component unused; client-orchestrated completion; 3.2s vanity boot screen masking fire-and-forget calls.
- **Change**: full two-track redesign (§6) with per-step server persistence and a single `complete-onboarding` edge function.
- **Layout**: keep the conversational chip UI (it's good); add a left progress spine showing the workspace literally assembling (context fields filling in) — the boot screen becomes real.
- **Remove**: `OnboardingWizard.tsx` (dead), timed redirect (replace with "workspace ready" state gated on actual provisioning success).

### 5.4 Home dashboard `/app/dashboard` (1,317 lines)

- **Purpose**: the cockpit — situation, next action, status.
- **Wrong**: 9-card feed; AI personalization exiled to `/app/ai-dashboard`; playbook data inline; client-side health math; no mode awareness.
- **Change**: merge `/app/ai-dashboard` into Home. Compose from a **module registry** keyed by mode + stage (§10). One focus module: **Next Best Action** (from missions + AI dashboard `quick_wins` + automation suggestions). Health ring driven by the AI dashboard's north-star metric.
- **Ideal layout** (12-col): Row 1: situation strip (stage, north star, streak, plan). Row 2: Focus — Current Mission / Next Best Action (8 col) + Bylda panel (4 col). Row 3: mode modules — Founder: launch assets, validation scorecard, path preview; Operator: KPI tiles, pipeline summary, automation status, approvals. Row 4 (collapsed): activity, playbook links.
- **Interaction**: every module has one primary action; "Why this?" popover on AI recommendations citing context.
- **Remove**: playbook accordion (→ Path), AskOperatorCard as a card (Bylda is the rail), duplicate stage trackers.

### 5.5 Tool hub `/app/launchpad` (684 lines)

- **Purpose**: find leverage when you know what outcome you want.
- **Wrong**: grid of 22–32 cards filtered by phase; duplicates visible; "use tool" framing.
- **Change**: rename **Workbench**; group by **outcome** (Validate · Position & Offer · Get Customers · Launch Assets · Fundraise · Analyze), each rendered as an outcome row: "Recommended next" (context-driven, max 3) on top; full catalog behind "All tools" disclosure. Show _why recommended_ ("because your validation verdict was ITERATE").
- **Layout**: recommended strip → outcome groups (collapsible) → recent runs.
- **Remove from default view**: uncataloged orphan tools until formalized; duplicates merged per §7.

### 5.6 Tool detail/run `/app/launchpad/$tool` (2,185 lines)

- **Purpose**: execute one outcome step with full context.
- **Wrong**: blank-form-first; context = 5 localStorage fields; output panel disconnected from mission; handoffs pass raw input text; 32 tools' field configs inline.
- **Change**: **context-first run screen**: panel 1 shows "What Bylda already knows" (from context graph — editable chips: business, stage, ICP, prior verdicts); panel 2 only asks the _delta_ fields; output panel renders structured blocks + **Recommended next actions** (structured, from output contract §8). Mission breadcrumb at top when arrived via a mission step.
- **Layout**: keep 60/40 split; add context strip above inputs; add "used context" receipt under output.
- **Remove**: per-tool field configs from the route file (→ catalog); free-floating "Continue with" links (→ structured next actions).

### 5.7 AI workspace / chat (IntelligenceRail 639, ByldaChatModal 1,144, Mentor 2,260, AskOperatorCard 331)

- **Purpose**: one ambient operator.
- **Wrong**: four chat implementations, two backends (`bylda-chat` edge fn vs `bylda-ai-api` worker), Mentor is a separate 2,260-line page, no shared conversation store across surfaces.
- **Change**: one `<ByldaPanel>` component (rail + expandable full-screen + Cmd-K invocation) on one backend; Mentor personas become Bylda modes ("Ask as: Strategist / Operator / Closer"); conversations persist to `bylda_conversations` regardless of surface. Bylda's replies use the existing tool-chip grammar to _do_ things (open tool with prefilled context, create automation draft, add mission step).
- **Remove**: `/app/mentor` as a route (redirect to Bylda full-screen mode), `AskOperatorCard` (rail replaces it), one of the two chat backends (keep `bylda-chat`, retire or proxy `bylda-ai-api` — decision in §11).

### 5.8 Automations `/app/automations` (1,149) + `/app/builder` (1,327) + `/app/integrations` (727)

- **Purpose**: leverage — repetitive work becomes systems.
- **Wrong**: toggle list of 6 automation systems disconnected from the builder; second automations page under `/app/scale`; approvals orphaned at `/app/approvals`; no "suggested automations from your actual behavior."
- **Change**: one **Automate** section with tabs: _Active_ (running automations + outcome metrics), _Opportunities_ (AI-suggested from context: e.g., "you logged 12 manual follow-ups → deploy follow-up sequence"), _Builder_, _Integrations_, _Approvals_ (agent action queue).
- **Layout**: outcome-first cards ("Booked 4 appointments this week"), not toggle rows.
- **Remove**: `/app/scale/automations`, standalone `/app/approvals` route (becomes tab).

### 5.9 CRM `/app/contacts` (1,446) + `/app/leads` (434) + `/app/bylda/crm` (3,189) + `/app/bylda/leads` (434)

- **Purpose**: one customer system of record feeding context.
- **Wrong**: three-plus overlapping surfaces with separate models (contacts status enum vs deal stages); 3,189-line kanban monolith; no link to ICP/persona outputs; founder mode sees enterprise CRM weight on day 1.
- **Change**: one **Customers** section: _People_ (contacts), _Pipeline_ (deals kanban/table), _ICP_ (persona outputs as living definitions). Founder mode default = simple list + "first 10 customers" tracker tied to the playbook tool; operator mode default = pipeline. CRM events (deal won/lost) write to context graph.
- **Remove**: `/app/leads`, `/app/bylda/leads`, `/app/bylda/crm` routes (redirect); split kanban monolith into DealBoard/DealTable/DealDetail components.

### 5.10 Settings `/app/settings` (901) + Billing `/app/billing` (842) + Integrations status

- **Purpose**: configuration, plan, trust.
- **Wrong**: business context is editable nowhere (profile quick-edit lives inside the tool runner; org fields scattered); integrations health invisible (no status of n8n/Stripe/AI providers); two surfaces for connectors (settings tab + integrations page).
- **Change**: Settings gains a **Business Context** tab — the human-readable context graph with edit + "re-run onboarding section" actions. Billing keeps plan/invoices/usage meters (wire `useUsageLimit` meters here). Add integration health chips (last webhook received, last automation run).
- **Remove**: connector duplication (one integrations surface, linked from settings).

### 5.11 Analytics / Insights `/app/ai-dashboard` (1,069) + `/app/bylda/reports` (20) + `/app/scale/reports` + `/app/monitoring` (545)

- **Purpose**: trend truth: KPIs, usage, automation ROI, AI recommendations over time.
- **Wrong**: `ai-dashboard` is static (generated once); reports pages are stubs (20 lines); monitoring is dev-ops flavored and unlinked to user value.
- **Change**: one **Insights** section: _KPIs_ (from kpi-dashboard tool output rendered as widgets + manual/integration data), _Weekly Review_ (auto-generated operating review — new feature §12), _AI activity_ (runs, credits, model usage), _System health_ (automation/integration status; absorbs monitoring).
- **Remove**: `/app/bylda/reports`, `/app/scale/reports` stubs; `/app/monitoring` as top-level nav (→ Insights tab; keep admin depth in `/app/admin`).

### 5.12 Journey pages `/app/playbook` (1,122) `/app/launchpad-path` (723) `/app/mission-control` (464) `/app/mission-briefing` `/app/launch-control` `/app/galaxy` (443) `/app/first-customers`

- **Purpose**: the guided spine — where am I in the journey, what are the missions.
- **Wrong**: six overlapping journey visualizations, none canonical; playbook content trapped in a route file constant.
- **Change**: one **Path** section: stage map (the 5-stage tracker), current + upcoming missions, completed missions with their produced assets, playbook content per stage (moved to `src/constants/` data or DB). Galaxy view can survive as Path's optional visualization toggle (it's the only place the spatial metaphor earns its keep).
- **Remove**: mission-control, mission-briefing, launch-control, launchpad-path as separate routes (redirect into Path); `first-customers` page (it's a playbook/mission, not a place).

### 5.13 Learn `/app/academy` `/app/tutorials` (793) `/app/blog/*` `/app/sop-library` (434) `/app/templates` (957) `/app/research` (763) `/app/assets` `/app/memory` (871)

- **Purpose**: reference material vs. owned artifacts — two different things currently mixed.
- **Change**: **Library** = owned artifacts: Assets (generated outputs), Templates, SOPs, Research, Memory sources (the `/app/memory` ingestion UI). **Learn** = academy/tutorials/blog, demoted to the help menu (topbar `?`), not primary nav.
- **Remove**: blog from app nav (marketing site concern); merge `assets` + `generated_assets` views.

### 5.14 Admin `/app/admin` (1,252)

- Keep. Add: provisioning failure queue (orphaned workspaces), webhook event log, prompt_feedback review tab (close the loop on §8), "reset onboarding" action per user.

---

## 6. NEW ONBOARDING ARCHITECTURE

### 6.0 Shared frame

- **Step 0 (the fork)** — first screen after auth: _"What brings you to Bylda?"_ → **„Create a business"** (I have an idea / starting from scratch) | **„Operate a business"** (I'm running one and want to scale it). Stored as `workspaces.mode: 'create' | 'operate'`. Visual identity diverges immediately (Create = violet/ignition imagery; Operate = cyan/systems imagery) so the paths _feel_ different, per requirement.
- **Persistence**: every answer upserts `onboarding_sessions` (new table: `user_id`, `mode`, `answers jsonb`, `step`, `status`) immediately. Returning users resume at their step.
- **Completion**: one server-side `complete-onboarding` edge function performs org/workspace/mission/context creation in a transaction-like saga (§11), replacing the client chain. The UI shows real provisioning states ("Creating workspace ✓ · Seeding your mission ✓ · Generating your dashboard ⏳") instead of a 3.2s timer.
- **Both paths emit the same canonical artifact**: a `business_context` row (§8) + a mode-tagged workspace + a generated dashboard + a first mission/playbook.

### 6.1 Track A — CREATE A BUSINESS (founders)

**Goal**: enough context to validate and sequence idea→launch, in under 3 minutes, conversational.

**Question flow** (chat UI, chips + short text; ✱ = required):

1. ✱ **Idea** — "What's the business you want to build?" (free text; existing question, kept)
2. ✱ **Industry / niche** — chip groups (SaaS, services/agency, e-commerce, content/creator, local business, marketplace, other) + free-text niche refinement.
3. ✱ **Target customer** — chips (SMBs, consumers, freelancers/creators, enterprise) + "describe them in a sentence" (optional text → much better ICP context).
4. ✱ **Stage** — Just an idea / Validating / Building / Ready to launch (maps to Idea|Validate|Launch).
5. **Current assets** — multi-select: nothing yet / landing page / waitlist or audience / prototype/MVP / first users / website URL (if URL → schedule `analyze-website` post-provisioning).
6. ✱ **Monetization direction** — subscription / one-time / services-retainer / usage / ads-affiliate / not sure.
7. ✱ **90-day goal** — first customers / validate before building / reach $X MRR / raise funding / launch publicly.
8. **Constraints** — multi-select: time (side project) / budget (<$1k, $1–10k, $10k+) / solo vs co-founder / non-technical.
9. **Timeline** — ASAP (30d) / this quarter / 6+ months.
10. **Experience** — first business / built before / exited before.

**Logic**: lane classifier v2 takes `(stage, goal, blocker-derived-from-goal, experience)` → lane; constraints modulate mission step sizing (side-project founders get smaller steps); assets skip steps (has landing page → skip landing-page mission step, queue website analysis instead).

**Saved context**: all answers → `business_context` (identity + stage + goals + constraints blocks) + `onboarding_sessions.answers` raw.

**Generated workspace**: mode=create; first mission per lane (existing seeds, now parameterized by constraints); Workbench shows only the lane's first-run tools (`FIRST_RUN_VISIBLE_TOOLS` honored); CRM in "first 10 customers" simple mode; Automations hidden behind "unlocks after first customers" teaser.

**First dashboard**: situation strip (stage = chosen, north star = from generated AI dashboard), focus = Mission step 1 ("Score your idea — 8 min"), support = validation scorecard placeholder + path preview, Bylda greets with idea-specific message.

**First AI recommendations**: generated dashboard `quick_wins` filtered to lane; e.g., Idea lane → run validator, kill-my-idea, draft 5 customer-interview questions (Bylda-chat task).

### 6.2 Track B — OPERATE A BUSINESS (operators)

**Goal**: map the machine — model, motion, bottlenecks, stack — to produce an ops cockpit and automation plan. Slightly longer, form-like sections (feels like an intake by an ops consultant, intentionally different texture from Track A's chat).

**Question flow** (3 grouped screens of chips/short fields):

_Screen 1 — The business:_ 1. ✱ Business name; 2. ✱ Company type (agency/services, SaaS, e-commerce, local/brick-and-mortar, consulting, content/media, other); 3. ✱ What you sell (productized service / custom services / physical product / software / content) + one-line description; 4. ✱ Revenue stage ($0–5k / $5–20k / $20–100k / $100k+ MRR equivalent); 5. ✱ Team size (solo / 2–5 / 6–15 / 16+).

_Screen 2 — The machine:_ 6. **Tool stack** — multi-select chips (Stripe, Shopify, HubSpot/CRM, Notion, Slack, QuickBooks, Google Workspace, Meta/Google Ads, none of these) → seeds integrations page + automation compatibility; 7. ✱ **Biggest bottlenecks** — multi-select max 3 (lead flow / sales conversion / fulfillment-delivery / hiring-team / reporting-visibility / churn-retention / founder time); 8. ✱ **Acquisition channels** — multi-select (referrals, outbound, paid ads, SEO/content, social, partnerships); 9. **Sales process maturity** — no defined process / founder-led / documented process / sales team; 10. **Fulfillment model** — done-by-founder / team-delivered / self-serve / hybrid.

_Screen 3 — The ambition:_ 11. **Reporting gaps** — "which numbers do you NOT see weekly?" (revenue, pipeline, CAC, churn, margins, team utilization); 12. **Automation appetite** — already automate / want suggestions / skeptical-show-me; 13. ✱ **Scale goal** — 2x revenue / same revenue less founder time / new product line / prepare to sell / build team.

**Logic**: lane = Systems (default) or Customer (if bottleneck = lead flow/sales and revenue < $20k); bottlenecks rank the Opportunities feed; tool stack gates which automations are shown as "ready to connect" vs "needs setup"; reporting gaps define the KPI widget set.

**Saved context**: all answers → `business_context` (identity + model + motion + bottlenecks + stack + goals blocks).

**Generated workspace**: mode=operate; **no founder missions** — instead an **Operating Baseline playbook**: (1) confirm KPI set (pre-built from reporting gaps), (2) connect top integration, (3) deploy first automation matching bottleneck #1, (4) run ops-plan tool seeded with full context. CRM in pipeline mode; Automations front-and-center with 3 ranked opportunities; Workbench shows Operate/Scale outcome groups first.

**First dashboard**: situation strip (revenue stage, team, north star = scale goal metric); focus = "Your top bottleneck: {X} — here's the system for it" (automation opportunity card with deploy CTA); support = KPI tiles (empty states prompting connection/manual entry), pipeline summary, integration health.

**First AI recommendations**: ops-plan quick wins ranked by bottleneck; automation suggestions referencing their actual stack ("You use Stripe + no CRM → deploy payment-failure recovery + simple pipeline").

### 6.3 Personalization engine (both tracks)

Next steps are recomputed from: mission/playbook state + context graph deltas + last 5 tool outputs + CRM/automation events. Surface as the Home focus module and Bylda's opening line. Rule order: (1) broken/blocked things (failed provisioning, failed automation), (2) in-progress mission step, (3) AI-ranked quick win, (4) re-engagement (stale streak → smallest viable action).

---

## 7. TOOL SYSTEM REDESIGN

### 7.1 Taxonomy

Six presentation classes replace "tool card":

- **Outcome engine** — multi-step wizard producing a major artifact (GTM plan, business plan).
- **Playbook** — checkable executable sequence mixing AI steps + human steps (first-10-customers).
- **Asset engine** — single-shot generator of a usable artifact (pitch, landing copy, emails, ads).
- **Advisor module** — scored assessment rendered as a widget with drill-in (validator, funding readiness).
- **Embedded assistant** — capability attached to another surface (persona inside CRM, SEO inside website analysis).
- **Background agent / trigger** — runs without a form (website analysis after URL capture, weekly review, feedback loop, automations).

### 7.2 Disposition of every tool

| Tool (slug)                                                             | Becomes                           | Where it lives / notes                                                                       |
| ----------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| idea-validator                                                          | Advisor module + wizard           | Mission step 1 (Create); scorecard persists as Home widget; standalone in Workbench·Validate |
| kill-my-idea                                                            | Wizard, chained                   | Offered after validator; **reads validator output** from context                             |
| niche-scorer / niche-validator                                          | Merged into validator             | Advanced option; retire duplicates                                                           |
| idea-vs-idea                                                            | Standalone wizard                 | Workbench·Validate; surfaced when context shows ITERATE verdict                              |
| competitor-scanner                                                      | Workflow step + research module   | Feeds positioning; output stored as structured `competitors` context                         |
| positioning-engine                                                      | Step 1 of GTM engine              | Standalone hidden; output = `positioning` context field                                      |
| gtm-strategy-builder                                                    | **Outcome engine**                | Consumes validator + positioning + ICP context; produces plan with linked next playbooks     |
| persona-builder                                                         | Embedded assistant                | Lives in Customers·ICP; output = structured personas used by all customer tools              |
| pricing-calculator / pricing                                            | One wizard                        | Inside Offer outcome; writes `revenue_model` + `price_point` context                         |
| business-plan-generator / business-plan                                 | **One document engine**           | Living doc in Library; sections regenerate from current context                              |
| mvp-planner                                                             | Workflow step                     | Build mission (Create mode only)                                                             |
| first-10-customers-finder                                               | **Playbook** (flagship)           | Checkable steps; creates CRM lead-list scaffold; progress on Home                            |
| pitch-generator                                                         | Asset engine                      | Output → Library·Assets; fundraising group                                                   |
| landing-page-creator                                                    | Asset engine                      | Chained from offer/GTM context                                                               |
| email-sequence                                                          | Asset engine + automation handoff | "Deploy as automation" CTA into followup-sequences                                           |
| cold-email / sales-script / vsl / blog / social / ad-copy / ad-creative | **Content Studio** asset engines  | One group, shared brand-voice context; merge ad-copy+ad-creative                             |
| kpi-dashboard                                                           | **Dashboard widget generator**    | Output renders as Insights·KPI tiles, not text                                               |
| seo-audit + analyze-website                                             | One **Website module**            | Background agent on URL capture + on-demand re-run; context-injected (fix §8)                |
| launch-checklist                                                        | Path content                      | Becomes mission steps, not a text generator                                                  |
| revenue-projector                                                       | Insights widget                   | Scenario sliders fed by context revenue data                                                 |
| investor-email-writer                                                   | Advisor module (Fundraise)        | Stage-gated: only when goal = raise funding                                                  |
| funding-readiness-score                                                 | Advisor module (Fundraise)        | Scorecard widget; gates investor tools                                                       |
| competitor (orphan)                                                     | Merge into competitor-scanner     | retire                                                                                       |
| 6 automation systems                                                    | Automation catalog                | Outcome cards in Automate·Opportunities, ranked by context bottlenecks                       |

### 7.3 Surfacing rules (anti-clutter)

1. **Default surface is the recommendation, not the catalog.** Home and Workbench lead with ≤3 context-ranked actions.
2. **Visibility = f(mode, stage, lane, plan).** Create mode hides Operate/Scale groups (teased, not listed); Operate mode hides Validate group; `FIRST_RUN_VISIBLE_TOOLS` generalizes into a `visibleWhen` predicate per catalog entry.
3. **Every tool knows why it's shown** — a `reason` string from the recommender, rendered on the card.
4. **One catalog** (`src/lib/catalog.ts`) is the single registry: absorb the 10 orphaned `TOOL_FIELDS` tools or delete them; field definitions move from the route into the catalog.
5. **Duplicates die**: 32 tools → ~22 surfaced experiences across 6 groups.

---

## 8. AI CONTEXT AND OUTPUT AUDIT

### 8.1 Context model — the Business Context Graph

One canonical, versioned context object per workspace. **Minimal-change implementation**: new `business_context` table (workspace_id PK, jsonb blocks, updated_at, version) — _additive_, no existing tables dropped; `onboarding_responses`/`workspace_intake` become write-through legacy until migrated.

Blocks: `identity` (name, idea/description, industry, niche, mode) · `customer` (target, ICP personas — structured from persona-builder) · `stage` (stage, lane, revenue band, team size) · `model` (monetization, pricing, fulfillment) · `goals` (90-day goal, scale goal, north star) · `constraints` (time, budget, experience, stack) · `verdicts` (validator score, kill-my-idea risks, funding readiness — structured) · `motion` (channels, sales maturity, bottlenecks) · `activity` (last 5 tool runs, mission state, CRM/automation summary stats).

### 8.2 Memory model

- Keep `memory_artifacts` but **store full output** (new `content` column) alongside the 500-char preview; previews remain the listing payload.
- Server-side writes: move `saveToMemory` from the client (`src/lib/saveToMemory.ts`) into the `run-tool` success path so memory can't silently diverge (client write is fire-and-forget today). _(recommended)_
- Embeddings/pgvector: **optional, later** — with ≤ a few hundred artifacts per org, recency + source_label filtering beats the complexity.

### 8.3 Prompt injection logic

New shared module `supabase/functions/_shared/context.ts`:

```
assembleContext(orgId, { toolKey, budgetTokens }) →
  [identity+stage block]          (always, ~150 tokens)
  [goal/constraint block]         (always, ~100)
  [relevant verdicts]             (per RELATED_TOOLS[toolKey], ~200)
  [last related outputs]          (memory_artifacts full content, trimmed to budget)
  [activity summary]              (one line)
```

- `run-tool` calls it and prepends to the user prompt; `buildUserPrompt(input)` becomes `buildUserPrompt(input, ctx)` (one signature change, every tool benefits).
- `bylda-chat` uses the **same assembler** with a hard token budget (fixes the unbounded 50-artifact injection, reliability risk #6).
- `analyze-website` gets the identity+customer+positioning blocks (fixes context-blindness).
- `generate-ai-dashboard` re-runs are triggered on context-graph version bumps (weekly cap), so the dashboard stays alive.

### 8.4 Routing logic

PAL stays as-is (plan base model + criticality/complexity escalation — it's well designed). Add: (a) context budget awareness (bigger context → don't downgrade to Haiku), (b) log `prompt_version` + context version per run (column exists in `ai_dashboards`, extend to `tool_runs`) for quality regression tracking.

### 8.5 Output structure — the output contract

Every tool schema (already enforced via forced tool_use) adds two required fields:

- `context_used: string[]` — which context facts shaped the output (rendered as the "receipt": _"Based on: B2B SaaS · pre-revenue · solo founder · validator verdict ITERATE"_). This is the single strongest anti-generic UX pattern: it makes specificity visible and auditable.
- `recommended_next_actions: [{ type: 'tool'|'mission_step'|'automation'|'manual', target, reason }]` — replaces free-text "Next Step" sections; feeds Home's Next Best Action and the post-output panel.

### 8.6 How previous actions influence future outputs

- Handoffs (`src/lib/handoffs.ts`) change from `search: { context: rawInput }` to `search: { fromRun: run_id }`; the target tool loads that run's output into the assembler (the agent-audit's `buildHandoffContext` pattern).
- Mission steps pass `mission_id` + prior step run ids; step 2 of a mission always sees step 1's output.
- Contradiction guard: assembler includes verdicts; system prompts gain one line — "If your recommendation contradicts a prior verdict in context, name the contradiction explicitly."

### 8.7 Preventing generic outputs

1. Context assembler (above) — the structural fix.
2. Run-time guard: if `business_context` is missing/empty, the run screen blocks with "Tell Bylda about your business first" (60-second mini-intake) instead of producing generic output.
3. Feedback loop graduates from logging to action: `prompt_feedback` suggestions surface in `/app/admin`; per-tool prompt_version A/B comes later (optional).
4. BYLDA_PREFIX gains: "Reference the founder's actual business by name and specifics from context in the first two sentences. If context is insufficient for a specific claim, ask for the one missing fact instead of generalizing."

### 8.8 AI recommends actions, not text

Bylda chat already emits actionable chips (`[→ TOOL: slug | label]`). Standardize this grammar across: chat replies, tool `recommended_next_actions`, dashboard focus module, and automation opportunities — one renderer (`<ActionChip>`), one analytics event (`recommendation_accepted`). That single pattern converts the whole product from "shows information" to "proposes execution."

---

## 9. DESIGN SYSTEM DIRECTION

- **Personality**: mission control, not arcade. Calm, dense-but-breathing, confident. The existing token base (violet `#8B5CF6` primary, slate surfaces, Cabinet Grotesk display / Satoshi body / JetBrains Mono data) is right — keep it; the work is governance, not reinvention.
- **Layout philosophy**: every page = `PageShell` (header: eyebrow/title/primary action · optional toolbar · 12-col content grid · optional right rail). Focus slot > support grid > archive accordions. Max 2 screens of content above archives.
- **Dashboard philosophy**: modules are registered, sized (S=3col, M=6, L=8/12), mode/stage-gated, and individually own loading/empty/error states. The dashboard composes; it doesn't hand-build.
- **Navigation philosophy**: 7 destinations (Home · Path · Workbench · Customers · Automate · Insights · Library) + Settings/Admin footer + Bylda as ambient layer + Cmd-K as the power surface (pages, tools, _and actions_: "deploy follow-up automation", "log a deal").
- **Visual hierarchy**: one accent per domain (Build violet, Customers cyan, Automate amber, Insights blue, Bylda pink — already in tokens as `--mentor-accent`, `--orbit-accent` etc.; rename to domain tokens). Glow shadows reserved for the focus module and active mission only.
- **Card system**: 3 tiers — `HeroCard` (focus slot, glow, 1 per page), `ModuleCard` (titled, 1 primary action), `RowCard` (list item). Ban inline color styles (ESLint rule).
- **Panel system**: right rail (contextual detail), bottom rail (Bylda), modal only for destructive/confirm. Drawers (vaul) for mobile detail.
- **Tool UI language**: context strip (what Bylda knows) → delta inputs → run → output blocks → receipt (`context_used`) → action chips. Same skeleton for every tool class so users learn it once.
- **Motion**: 150–250ms ease-out for state changes; one "ignition" moment per session max (mission complete, workspace provisioned). Kill ambient pulse animations on dashboards; GSAP stays on marketing pages only, lazy-loaded.
- **Premium = restraint**: fewer borders, more spacing rhythm; mono font for all numbers; no badge soup ("new" badges currently on 3 nav items — remove after 2 weeks by rule).

---

## 10. FRONTEND ARCHITECTURE RECOMMENDATIONS

- **Route strategy**: introduce pathless `_authenticated` layout (per the original `.lovable/plan.md` intent) wrapping `/app`; consolidate to the 7-section tree; keep old paths as `redirect` routes for 2 releases (`/app/contacts → /app/customers`, `/app/bylda/crm → /app/customers/pipeline`, `/app/mentor → /app?bylda=full`, `/app/ai-dashboard → /app/dashboard`, etc.). Delete dead routes (`command-center`, `bylda-full`, `bylda-os/*`, `scale/*`, `blog/*`) after redirect period.
- **Component hierarchy**: `src/components/{shell,modules,tools,bylda,ui}`. Split the four monoliths first: OutputRenderer (5,333) → `tools/output/` block renderers per output type; bylda.crm (3,189) → `customers/` (Board, Table, DealDrawer, Forecast); $tool (2,185) → `tools/` (ContextStrip, FieldForm from catalog defs, RunPanel); mentor (2,260) → deleted in favor of `bylda/ByldaPanel`.
- **State considerations**: React Query stays; add query-key factory (`keys.ts`); route `loader`s with `ensureQueryData` for Home/Path/Customers (kills waterfall + enables instant paint); one `invokeEdge()` wrapper (timeout via AbortController, `resp.ok` check, typed error → toast/ErrorState, single retry on 5xx) replacing all raw `fetch`/`functions.invoke` calls — this alone fixes frontend reliability risk #7.
- **Dashboard composition model**: `module registry` — `{ id, size, modes: ['create'|'operate'], stages, query, component, emptyState }`; Home renders `registry.filter(eligible)`; AI dashboard payload becomes data for modules (headline → situation strip, kpis → KPI tiles, quick_wins → focus feed) rather than a separate page.
- **Module system**: each module owns skeleton/empty/error internally (wrap in `<ModuleBoundary>` with per-module error fallback so one failed query never blanks the page).
- **Progressive disclosure strategy**: `visibleWhen(context)` predicates on catalog entries, nav items (Automate hidden pre-first-customer in create mode → teaser), and modules. One mechanism, used everywhere, replacing scattered ad-hoc gating.
- **Workspace profile**: delete localStorage `workspaceProfile.ts` as source of truth; it becomes a read-through cache of `business_context`.

---

## 11. BACKEND / EDGE FUNCTION / RELIABILITY AUDIT

Verdict first: **the architecture holds — do not rewrite it.** Supabase functions + PAL + queues are sound. Fix the seams. Each fix marked **required / recommended / optional**.

| Flow                       | Depends on                                                                               | Likely failure                                                                                                                                                                                           | User-facing symptom                                                  | Fix                                                                                                                                                                                                                                                   | Priority                                            |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Signup                     | Supabase auth + profile trigger + (legacy `/signup` also inserts org+subscription)       | Dual signup paths create divergent state                                                                                                                                                                 | Some users have org before onboarding, some don't                    | Single signup route; org creation only in `complete-onboarding`                                                                                                                                                                                       | **required**                                        |
| Auth/session               | `getSession` in `beforeLoad`; in-memory `onboardedUsers` set                             | Stale set after sign-out/in of different user on same tab                                                                                                                                                | Wrong redirect                                                       | Key cache by user id (already) + clear on `SIGNED_OUT`                                                                                                                                                                                                | recommended                                         |
| Onboarding save            | Currently in-memory only until completion                                                | Tab close = total loss                                                                                                                                                                                   | Re-answer everything                                                 | `onboarding_sessions` table + per-step upsert                                                                                                                                                                                                         | **required**                                        |
| Onboarding completion      | 8-step client chain (`onboarding.tsx:47-193`)                                            | Any mid-chain failure → half-provisioned "complete" user                                                                                                                                                 | Empty dashboard, no missions, no AI dashboard; looks broken on day 0 | New `complete-onboarding` edge fn: validate → org → workspace+mission+steps (single RPC `provision_workspace_tx` in plpgsql for atomicity) → context write → flag → return; client just polls status. Provisioning becomes **blocking with retry UI** | **required**                                        |
| Workspace creation         | `provision-workspace` multi-insert, no transaction                                       | Workspace without mission/steps                                                                                                                                                                          | Empty Path/Home                                                      | Wrap inserts in a plpgsql function (one migration, ~30 lines); add `provisioning_status` to workspaces; Home shows repair CTA ("Finish setting up") that re-invokes idempotent provisioning                                                           | **required**                                        |
| Dashboard generation       | `generate-ai-dashboard` fire-and-forget; insert after Claude call                        | Claude/API failure → no row                                                                                                                                                                              | `/app` AI modules silently empty                                     | Generate during completion fn with 1 retry; on failure write `status:'failed'` row; frontend renders "Generating…/Retry" states from status                                                                                                           | **required**                                        |
| Context retrieval          | org + onboarding_responses + workspace_intake joins                                      | Field mismatch (`idea`→`offer`), missing rows                                                                                                                                                            | Generic AI outputs, empty prefills                                   | `business_context` table + assembler (§8) as single read path                                                                                                                                                                                         | **required** (foundation for AI goals)              |
| AI tool execution          | `run-tool` → PAL → Anthropic; run row status='running'                                   | Crash mid-run leaves rows stuck 'running'; `palResult.toolResult!` non-null assertion can throw                                                                                                          | Stuck "Generating…" history rows                                     | pg_cron sweep: runs >10min old → 'failed'; guard toolResult with explicit error                                                                                                                                                                       | **required** (sweep) / recommended (guard)          |
| AI chat execution          | `bylda-chat` + duplicate `bylda-ai-api` worker                                           | Unbounded context (token overflow); two backends drift                                                                                                                                                   | Chat errors with cryptic message; inconsistent behavior per surface  | Token-budgeted assembler; pick ONE backend — keep `bylda-chat` (Supabase, nearer the data), point the worker route at it or retire it                                                                                                                 | **required** (budget) / recommended (consolidation) |
| Save outputs               | `tool_runs` update + `generated_assets` insert + client `saveToMemory`                   | Client memory write silently fails                                                                                                                                                                       | Memory page missing runs; AI "forgets"                               | Move memory write server-side into run-tool success path                                                                                                                                                                                              | recommended                                         |
| Fetch outputs              | React Query + RLS                                                                        | Tables WITHOUT RLS: `credit_ledger`, `operator_memory`, `tool_outputs`, `support_tickets`, `n8n_error_log`, `user_ai_config`, `automation_drafts`, `client_kpi_metrics` (squash migration lines 258–621) | Data exposure risk                                                   | Enable RLS + owner policies (one migration; verify with `get_advisors`)                                                                                                                                                                               | **required** (security)                             |
| Automations trigger        | Cloudflare queue `bylda-automation-queue` + consumer                                     | No DLQ, no retry/backoff config, no observability                                                                                                                                                        | Automations silently never run                                       | Add `max_retries` + DLQ binding in wrangler; write consumer failures to `n8n_error_log`; surface in Insights·System health                                                                                                                            | **required** (DLQ) / recommended (surfacing)        |
| Integrations status        | `save-integration` + encrypted configs                                                   | Encryption key falls back to service-role key                                                                                                                                                            | Security downgrade, invisible                                        | Require `INTEGRATIONS_ENCRYPTION_KEY`; fail closed with clear 503                                                                                                                                                                                     | **required**                                        |
| Plan gating                | `plan_tier_limits` + `usage_tracking` read-then-increment                                | Concurrent runs exceed quota; fire-and-forget increment                                                                                                                                                  | Revenue leakage                                                      | Single plpgsql `consume_quota(org, tool)` doing atomic check+increment (`UPDATE … RETURNING`); call before model invocation                                                                                                                           | **required**                                        |
| Billing webhook            | `payments-webhook`                                                                       | Missing org metadata → return 200 + skip; unknown lookup_key → plan unchanged; DB error → still 200; no idempotency                                                                                      | **Paid user stuck on old plan**; support tickets                     | Return 500 on DB failure (Stripe retries); store `stripe_event_id` with unique constraint; alert row on unmapped lookup_key; backfill job comparing Stripe subs vs DB                                                                                 | **required**                                        |
| Permissions                | `has_role` + org_members RLS                                                             | Generally sound post-#59 fix                                                                                                                                                                             | —                                                                    | Periodic `get_advisors` check in CI                                                                                                                                                                                                                   | optional                                            |
| Loading/retries (frontend) | raw fetch in chat/cards                                                                  | Hang/blank on 5xx                                                                                                                                                                                        | Dead panels                                                          | `invokeEdge()` wrapper everywhere (§10)                                                                                                                                                                                                               | **required**                                        |
| n8n ops layer              | 40+ workflows in `/N8N`, several referencing non-existent tables; duplicate provisioning | Drift, confusion about ownership                                                                                                                                                                         | Mystery automation failures                                          | Decision: edge functions own product flows; n8n owns comms/billing-ops only. Archive the 4 broken + duplicate workflows; document ownership in `n8n/README`                                                                                           | recommended                                         |
| CORS                       | wildcard on all functions                                                                | CSRF-ish exposure                                                                                                                                                                                        | —                                                                    | Restrict to app origins                                                                                                                                                                                                                               | recommended                                         |
| analyze-website            | unbounded fetch                                                                          | Function hangs to platform timeout                                                                                                                                                                       | Spinner forever                                                      | AbortController 15s + 2MB cap + content-type check                                                                                                                                                                                                    | **required**                                        |
| Observability              | console.log only                                                                         | Can't diagnose production                                                                                                                                                                                | —                                                                    | requestId + orgId structured log line per function (tiny `log()` helper in `_shared`)                                                                                                                                                                 | recommended                                         |

---

## 12. RECOMMENDED FEATURE ADDITIONS

| Feature                                                    | Why it matters                                                                                            | Segment        | Retention             | Revenue                             | Complexity                      | Build/Integrate/Automate         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- | --------------------- | ----------------------------------- | ------------------------------- | -------------------------------- |
| **Two-track onboarding (mandated)**                        | Right context, right workspace, day-0 relevance                                                           | Both           | ★★★★★                 | ★★★★ (operator tier sells $149/299) | M                               | Build                            |
| **Business Context Graph + assembler (mandated, enabler)** | Single source of truth; makes every AI output specific                                                    | Both           | ★★★★★                 | ★★★★                                | M                               | Build                            |
| **Tool→outcome restructuring (mandated)**                  | Kills tool-overload; converts usage into progress                                                         | Both           | ★★★★                  | ★★★                                 | M-L                             | Build                            |
| **Next Best Action engine (Home focus)**                   | The product tells you what to do — core promise                                                           | Both           | ★★★★★                 | ★★★                                 | S-M (rules over existing data)  | Build                            |
| **Context receipt (`context_used` on outputs)**            | Makes specificity visible; trust + perceived intelligence                                                 | Both           | ★★★★                  | ★★                                  | S                               | Build                            |
| **Server-side onboarding completion saga**                 | Eliminates the worst failure mode (broken day-0)                                                          | Both           | ★★★★ (activation)     | ★★★                                 | S-M                             | Build                            |
| **Weekly Operating Review (auto-generated)**               | Pulls users back weekly (the stated Weekly Loop stage has no feature driving it); operator killer feature | Operator-heavy | ★★★★★                 | ★★★★                                | M (cron + assembler + template) | Build+Automate                   |
| **Automation Opportunities feed**                          | Turns context bottlenecks into automation revenue                                                         | Operator       | ★★★★                  | ★★★★★ (drives $149→$299)            | M                               | Build                            |
| **Unified Customers (CRM merge)**                          | One system of record; feeds context loop                                                                  | Both           | ★★★                   | ★★                                  | M (mostly consolidation)        | Build                            |
| **Approvals queue for agent actions**                      | Trust layer for automation-first ops; prereq for more autonomous agents                                   | Operator       | ★★★                   | ★★★                                 | S (route exists, formalize)     | Build                            |
| **Integration health panel**                               | Silent integration failure is a churn event                                                               | Operator       | ★★★                   | ★★                                  | S                               | Build                            |
| **Edit Business Context + re-run onboarding section**      | Businesses change; context must not fossilize                                                             | Both           | ★★★                   | ★                                   | S                               | Build                            |
| **Living Business Plan (doc engine)**                      | Flagship artifact regenerating from context — demo-able wow                                               | Founder        | ★★★                   | ★★★                                 | M                               | Build                            |
| **Prompt feedback admin loop**                             | Closes the existing dead-end `prompt_feedback` pipeline                                                   | Internal       | ★★ (indirect quality) | ★★                                  | S                               | Build                            |
| Embeddings memory search                                   | Better retrieval at scale                                                                                 | Both           | ★★                    | ★                                   | M                               | Integrate (pgvector) — **defer** |

---

## 13. PRIORITIZED IMPLEMENTATION ROADMAP

**Phase 1 — Highest-leverage UX fixes (1–2 wks) · Risk: LOW**
Objective: stop the bleeding without moving data.
Deliverables: `invokeEdge()` wrapper adopted everywhere; new 7-item nav with redirect routes (no page rewrites yet — remap existing pages); kill dead routes; merge `/app/ai-dashboard` content into `/app/dashboard` top (render payload modules); empty/error states for AI dashboard, missions, chat panels; analyze-website timeout; stuck-run sweep cron.
Dependencies: none. Impact: immediate perceived stability + coherence.

**Phase 2 — Onboarding split (2–3 wks) · Risk: MEDIUM**
Objective: two tracks, durable completion.
Deliverables: Step-0 fork UI; Track A & B flows; `onboarding_sessions` table; `business_context` table; `complete-onboarding` edge fn + `provision_workspace_tx` RPC; provisioning status UI + repair CTA; `workspaces.mode` column; mode-aware Home registry v1 (founder vs operator module sets); settings Business Context tab.
Dependencies: Phase 1 wrapper. Impact: activation rate, operator-tier acquisition.

**Phase 3 — Dashboard & tool restructuring (3–4 wks) · Risk: MEDIUM**
Objective: outcomes, not tool cards.
Deliverables: catalog as single registry (field defs moved in, orphans resolved, duplicates merged per §7 table); Workbench outcome groups + recommended strip; tool run page context strip (reads `business_context`); Path consolidation (mission-control/briefing/launch-control/path → one); Customers merge (contacts+leads+crm) with mode defaults; Automate consolidation (+Opportunities tab v1, rules-based); Library consolidation; split OutputRenderer + crm monoliths opportunistically as pages are touched.
Dependencies: Phase 2 (`business_context`). Impact: tool-overload solved; session depth.

**Phase 4 — AI context/output improvements (2–3 wks) · Risk: MEDIUM (prompt regressions — mitigate with prompt_version logging)**
Objective: specificity.
Deliverables: `_shared/context.ts` assembler; `buildUserPrompt(input, ctx)` migration across all tools; output contract (`context_used`, `recommended_next_actions`) + ActionChip renderer; handoffs by `fromRun` id; bylda-chat token budget + same assembler; analyze-website context injection; memory full-content column + server-side memory writes; missing-context guard on run screens; dashboard regeneration on context version bump.
Dependencies: Phases 2–3. Impact: the "outputs feel generic" complaint dies; measurable via thumbs-up rate + re-run rate (feedback-loop already measures the latter).

**Phase 5 — Backend/edge reliability hardening (2 wks, parallelizable with 3–4) · Risk: LOW-MEDIUM**
Objective: the §11 required items not yet done.
Deliverables: RLS migration for 8 unprotected tables; webhook idempotency (`stripe_event_id` unique) + 500-on-failure + unmapped-plan alerting + reconciliation job; atomic `consume_quota` RPC; queue DLQ + retries; CORS restriction; encryption key fail-closed; structured log helper; n8n archive/ownership doc.
Dependencies: none (DB-level). Impact: billing integrity, security posture.

**Phase 6 — Polish & refinement (ongoing, 2 wks focused) · Risk: LOW**
Objective: premium feel + the retention features.
Deliverables: Weekly Operating Review; Living Business Plan engine; Cmd-K actions; domain accent governance + inline-style lint; motion pass; mobile monitor/approve pass; landing page rework; Learn → help menu; admin provisioning-repair + prompt-feedback tabs.
Dependencies: Phases 2–4. Impact: weekly-loop retention, perceived quality.

---

## 14. PRIORITY SCORING

(Impact / Difficulty / Revenue / Retention / Bylda-fit, each 1–10)

| Recommendation                                              | Impact | Difficulty | Revenue | Retention | Bylda Fit |
| ----------------------------------------------------------- | ------ | ---------- | ------- | --------- | --------- |
| Two-track onboarding + completion saga                      | 10     | 6          | 8       | 9         | 10        |
| Business Context Graph + context assembler                  | 10     | 6          | 7       | 9         | 10        |
| Nav collapse to 7 destinations (+redirects)                 | 9      | 4          | 5       | 8         | 10        |
| Home = single cockpit (merge ai-dashboard, module registry) | 9      | 5          | 6       | 9         | 10        |
| Output contract (context receipt + action chips)            | 9      | 4          | 6       | 8         | 10        |
| Tool→outcome restructure + catalog unification              | 8      | 7          | 6       | 8         | 10        |
| Next Best Action engine                                     | 8      | 4          | 6       | 9         | 10        |
| Billing webhook hardening + reconciliation                  | 8      | 3          | 9       | 6         | 8         |
| RLS on 8 unprotected tables                                 | 8      | 2          | 3       | 3         | 9         |
| `invokeEdge` wrapper + chat error states                    | 7      | 2          | 3       | 7         | 9         |
| Customers (CRM) unification                                 | 7      | 6          | 5       | 7         | 9         |
| Automation Opportunities feed                               | 7      | 5          | 9       | 7         | 10        |
| Weekly Operating Review                                     | 7      | 5          | 7       | 9         | 10        |
| Atomic quota consumption                                    | 6      | 3          | 7       | 3         | 8         |
| Bylda consolidation (one chat backend/UI)                   | 6      | 5          | 3       | 6         | 9         |
| Monolith component splits                                   | 5      | 6          | 1       | 3         | 7         |
| n8n cleanup/ownership doc                                   | 5      | 3          | 2       | 2         | 7         |
| Embeddings memory search                                    | 4      | 6          | 2       | 4         | 7         |

---

## 15. FINAL OUTPUT MODE — HANDOFF NOTES

- **Designer**: start from §9 + §5.4 (Home) + §6 (onboarding screens). Tokens already exist in the codebase; deliver Figma frames for PageShell, the 3 card tiers, the tool run skeleton, and both onboarding tracks.
- **Frontend engineer**: start from §10. First PRs: `invokeEdge()`, nav + redirects, module registry, ai-dashboard merge. Touch monoliths only when their page is being rebuilt.
- **Backend engineer**: start from §11 table, required items only: RLS migration, `provision_workspace_tx`, `complete-onboarding`, `consume_quota`, webhook idempotency, stuck-run sweep, analyze-website timeout. All are additive migrations or single-function changes — no schema rewrites, no AI routing changes (PAL untouched).
- **PM**: instrument the funnel that already has names (`activation_events`: first_tool_run, first_mission_completed, weekly_return) against Phases 2–4; the success metric for Phase 4 is re-run rate (already captured by feedback-loop) trending down and output thumbs-up trending up.

**Prime directive for all four:** every change must reduce fragmentation (fewer surfaces, one context, one registry, one wrapper) and strengthen the closed loop (every action feeds context; context shapes every recommendation). Anything that adds a new parallel surface, a second source of truth, or an uncontextualized AI call is — by this blueprint — wrong by default.

---

## APPENDIX — IMPLEMENTATION STATUS (2026-06-10)

All six phases implemented on `claude/adoring-gauss-ukfg3e`:

| Phase                        | Status          | Key commits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — UX fixes                 | ✅ shipped      | invokeEdge gateway; 7-destination nav + 15 legacy redirects; AI briefing on Home; aiDashboardQuery crash fix; analyze-website timeout; stuck-run sweep                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2 — Onboarding split         | ✅ shipped      | Create/Operate fork; per-step persistence (onboarding_sessions); business_context graph; provision_workspace_tx; complete-onboarding saga; repair banner; Settings context tab                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3 — Tool restructuring       | ✅ shipped      | Workbench recommended strip + outcome groups; context-first tool runner ("Bylda knows" strip + server-hydrated prefills); Customers pill nav; Automation Opportunities feed                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4 — AI context               | ✅ shipped      | assembleContext (graph + related prior outputs + fromRun chaining); output contract (context_used receipt + recommended_next_actions chips); server-side full-content memory; verdict capture; bylda-chat budget; analyze-website context                                                                                                                                                                                                                                                                                                                                      |
| 5 — Reliability              | ✅ shipped      | RLS on 8 tables; webhook idempotency + retry semantics + alerts; atomic consume_quota/refund_quota; encryption fail-closed; structured log helper; n8n ownership doc                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6 — Polish                   | ✅ core shipped | Weekly Operating Review (cron + on-demand + Insights card); Cmd-K actions group; settings ?tab deep-links                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7 — Loop-closers             | ✅ shipped      | Admin **Reliability** tab: provisioning repair queue, ops alerts (n8n_error_log), Stripe webhook ledger, prompt-feedback review with mark-applied (§8.7); admin-read policies for workspaces + prompt_feedback                                                                                                                                                                                                                                                                                                                                                                 |
| 8 — Design system governance | ✅ shipped      | Domain accent tokens (`--domain-build/customers/automate/insights/bylda`) wired through Tailwind theme; **SectionTabs** primitive unifies Customers/Path/Insights into tabbed sections (mounted on 9 pages); **ModuleBoundary** per-module error isolation on Home + Insights; mobile tab bar relabeled to the 7-destination IA; non-blocking query prefetch in /app beforeLoad (§10); ESLint token-governance rule (raw hex in inline styles → warning register, 194 sites); Current Mission mounted as Home's focus module (§5.4) with its eternal-spinner empty state fixed |

### Remaining backlog (with rationale — not blocking)

**Churn-only — do when the page is next rebuilt, not before** (splitting without redesigning doubles the work):

- TOOL_FIELDS → catalog move (~1,150 lines, pure relocation).
- Monolith splits: OutputRenderer 5.3k, bylda.crm 3.2k, mentor 2.3k.

**Risky if partial — needs a dedicated pass:**

- **CORS allowlist**: must touch the `OPTIONS` handler in all ~25 functions at once; a partial rollout breaks every edge call. JWT remains the real auth gate, so this is posture, not a hole. Do as one focused PR with an `ALLOWED_ORIGINS` env + reflective `corsHeadersFor(req)` helper.

**Net-new features beyond the audit scope** (scored in §12/§14 — pull in on request):

- Approvals queue for agent actions (route exists, needs an agent-action model).
- Living Business Plan doc engine.
- User-facing Integration health panel (admin Ops-alerts tab covers the internal view today).
- Embeddings memory search (deferred — recency + source filtering wins at current scale).
- Prompt-variant A/B (the feedback pipeline now surfaces to admins; auto-A/B is the next step).
- Landing page rework.

### Deploy checklist (ops)

1. Apply migrations `20260610100001…100006` (idempotent; pg_cron blocks no-op if extension absent).
2. Deploy edge functions: `complete-onboarding`, `weekly-review` (new); `run-tool`, `bylda-chat`, `analyze-website`, `payments-webhook`, `save-integration` (updated) + `_shared`.
3. Set `INTEGRATIONS_ENCRYPTION_KEY` secret (save-integration now fails closed without it).
4. Verify pg_cron jobs: `stuck-run-sweep-10min`, `weekly-review-monday`, existing `feedback-loop-30min`.
