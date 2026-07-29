# Automation Builder & Publishing — GoHighLevel / HubSpot parity

_Shipped: 2026-06-19. Branch: `claude/optimistic-ramanujan-ihqzmi`._

This change turns the visual workflow Builder into a GoHighLevel-style automation
system: a rich trigger/action library, prebuilt recipes, and — the headline ask —
the ability to **build an automation once and publish it, choosing who it's for**
(yourself, a specific client, all your clients, or a public marketplace).

---

## What shipped

### 1. Publish an automation & pick the audience

`PublishModal` in `src/routes/app.builder.tsx` lets an operator publish the current
canvas as a reusable **template**, choosing an audience scope:

| Scope         | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `self`        | Private template only this workspace can install.                  |
| `client`      | Published for one specific CRM contact (searchable client picker). |
| `all_clients` | Rolled out to every client the agency manages.                     |
| `marketplace` | Public — any other operator can install it.                        |

Backed by two new tables (`supabase/migrations/20260619000001_automation_templates.sql`):

- **`automation_templates`** — the published snapshot (name, description, category,
  `blocks` JSONB, `trigger_summary`, `audience_scope`, `target_contact_id`, tags,
  `install_count`, status). RLS: org members manage their own; **marketplace** rows
  are readable by every authenticated user.
- **`automation_template_installs`** — install ledger.
- **`install_automation_template(...)`** — `SECURITY DEFINER` RPC that records an
  install and bumps `install_count` even for a marketplace template owned by
  another org (which RLS would otherwise block).

### 2. Workflow Templates library / marketplace

New route `src/routes/app.workflow-templates.tsx` (nav: **Automate → Workflow
Templates**):

- **My templates** — everything this org published, with audience badges, install
  counts, edit (re-open in Builder), and archive.
- **Marketplace** — public templates ranked by installs; one-click **Install**
  records the install and opens the workflow in the Builder ready to activate.
- **Quick-start recipes** strip that deep-links into the Builder (`?recipe=slug`).

### 3. Prebuilt recipes (GHL "recipes" / snapshots)

`src/lib/automation-recipes.ts` — 8 ready-to-edit workflows across Lead Nurture,
Booking, Sales, Retention, Reputation, and Onboarding (Speed-to-Lead, Appointment
Reminders & No-Show Rescue, Abandoned Checkout Recovery, Pipeline Auto-Mover,
5-Star Review Request, Win-Back, New Client Onboarding, Long-Term Nurture). Loaded
from the Builder's **Templates** picker or via `?recipe=` deep-link.

### 4. Builder upgrades

- The whole block catalog moved to a shared module
  `src/lib/automation-blocks.ts` (single source of truth for Builder, recipes, and
  marketplace previews).
- **Save** now writes to `workflow_builders` (the purpose-built table that
  `AdaptiveGuidance` already reads) instead of the orphaned `automation_drafts`.
- Deep-link loading (`?recipe=` / `?template=`), a "Start from a workflow" picker
  (recipes + your published templates), and a Publish flow.

---

## Gap-fill vs GoHighLevel & HubSpot

The trigger/action/logic palette went from ~20 blocks to **40+**, adding the
primitives those platforms are built on:

**New triggers** — Tag Added, Appointment Booked, Email Event (open/click/reply/
bounce/unsub), Pipeline Stage Changed, Customer Replied, Birthday/Date, Call
Status, Abandoned Checkout, Contact Created, Property Changed.

**New actions** — Add/Remove Tag, Move Pipeline Stage, Create Opportunity, Assign
Owner (round-robin), Ringless Voicemail, Add/Remove from Workflow (enroll/unenroll),
Set Field/Property value, Add Note, Request Review (reputation).

**New logic** — Wait Until (event/time), A/B Split test (plus existing If/Else,
Wait, Loop).

Together with publishing, audience targeting, the recipe library, and the
marketplace, this brings the platform to GHL-style **workflows + snapshots/recipes**
and HubSpot-style **workflows/sequences + enrollment** on the Bylda (operate) side.

---

---

## Execution engine (shipped + deployed live)

The Builder is no longer write-only — workflows actually run.

- **`run-workflow` edge function** (`supabase/functions/run-workflow/`, deployed to
  the live project) walks a block-graph and performs the real side effect for each
  step, writing a per-step trace.
- **`automation_workflow_runs`** table (migration `20260619000002`) records every
  run (mode, status, trace, duration) under org-scoped RLS.
- **Builder → Run modal**: the Test / Live tabs open a run dialog where you pick a
  contact and execute. `mode: "test"` simulates everything; `mode: "live"` performs
  real sends/updates. The real trace renders inline on the canvas.
- **`get_user_integration`** decrypt RPC (service-role only) lets the engine read an
  operator's **bring-your-own** SendGrid / Slack credentials from `user_integrations`
  (the GoHighLevel sub-account model), falling back to platform secrets.

### What executes live vs. simulated

| Step                                                                 | Status                                                                                                | Credential                                                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AI (generate / classify / score)                                     | **LIVE now**                                                                                          | `ANTHROPIC_API_KEY` — already set (powers `bylda-chat`)                                                         |
| Outbound webhook                                                     | **LIVE now**                                                                                          | none needed                                                                                                     |
| CRM writes (add/remove tag, move stage, set field, add note, memory) | **LIVE now**                                                                                          | service role                                                                                                    |
| If/Else, A/B split                                                   | **LIVE now** — the engine takes only the chosen lane (waits are recorded; real delays need the queue) | none                                                                                                            |
| Send Email                                                           | simulated until key set                                                                               | `SENDGRID_API_KEY` (+ `SENDGRID_FROM_EMAIL`) **or** operator connects SendGrid in Integrations                  |
| Send SMS                                                             | simulated until keys set                                                                              | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` **or** operator connects Twilio in Integrations |
| Notify team (Slack)                                                  | simulated until set                                                                                   | `SLACK_WEBHOOK_URL` **or** operator connects Slack in Integrations                                              |

Any step without credentials is clearly labelled `simulated` in the trace, so the
engine works today and each channel goes live the instant its key is added.

### Provider credentials — what's needed

These are paid third-party accounts that must be created by the account owner (they
can't be provisioned from here). Add them as Supabase Edge Function secrets:

```bash
supabase secrets set SENDGRID_API_KEY=SG.xxxx SENDGRID_FROM_EMAIL=you@yourdomain.com
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxx TWILIO_AUTH_TOKEN=xxxx TWILIO_FROM_NUMBER=+1xxxxxxxxxx
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx   # optional
```

### Operators bring their own (no platform secret needed)

Each operator can connect their **own** provider accounts under **Integrations** —
credentials are encrypted (`pgp_sym_encrypt`) and decrypted only inside the
`run-workflow` service path, scoped to the automation's owner. BYO always takes
priority over the platform secret fallback. Providers that need more than one value
capture them as **multi-field** credentials (stored under separate keys):

| Provider           | Fields captured                        | Stored keys                           |
| ------------------ | -------------------------------------- | ------------------------------------- |
| SendGrid           | API key + verified from-email          | `sendgrid`, `sendgrid_from`           |
| Twilio             | Account SID + auth token + from-number | `twilio_sid`, `twilio`, `twilio_from` |
| Slack              | Incoming webhook URL                   | `slack`                               |
| Anthropic (Claude) | API key                                | `anthropic`                           |

So an agency operator can run client automations entirely on their own SendGrid /
Twilio / Slack / Claude accounts without any platform-wide secret being set.

## Autonomous triggering (shipped + deployed live)

Active automations now fire on their own — no one has to click Run.

- **Activate** a published template (toggle on its card in Workflow Templates) →
  it's registered in `active_automations` with its entry trigger and goes live.
- **Safe event capture**: `AFTER` triggers on `contacts` (insert + tag change),
  added in migration `20260619000003`, enqueue an `automation_events` row. They're
  `SECURITY DEFINER`, exception-guarded (can never break a contact write), and only
  enqueue when a matching active automation exists for the org (verified by an
  assert-and-rollback DB test: no event with no automation, exactly one on
  `contact.created` and on `tag.added`).
- **`automation-dispatch`** edge function (deployed) drains the queue and runs each
  matching automation via `run-workflow`'s internal service path. Two callers:
  the **app nudge** (an org member, scoped to their own org — fires within seconds
  of a new contact/tag) and **pg_cron** (every minute, all orgs).
- New in-app contacts are now org-scoped and nudge the dispatcher on create, so
  "new lead" automations fire immediately.

### Enabling the server-side cron (one-time, optional)

The app-nudge path works today. For fully server-driven firing (e.g. contacts
created by external APIs/forms), enable the same prerequisites the repo's existing
crons already need — they're currently dormant because these were never set:

1. Dashboard → Database → Extensions: enable **pg_cron** and **pg_net**.
2. Configure the GUCs the cron reads:
   ```sql
   alter database postgres set app.settings.supabase_url = 'https://<ref>.supabase.co';
   alter database postgres set app.settings.service_role_key = '<service_role_key>';
   ```
   Re-running migration `20260619000003` then schedules `automation-dispatch-1min`.

## Follow-ups / deferred

- **Scheduled waits**: `logic_wait` / `logic_wait_until` are recorded but not yet
  suspended-and-resumed. Real delays should enqueue onto the existing
  `bylda-automation-queue` + consumer worker (which already has SendGrid/Twilio).
- **More event sources**: `contact.created` and `tag.added` fire today. `payment.received`
  is mapped and ready — wiring it just needs a one-line enqueue in `payments-webhook`.
  Form/stage/appointment triggers are next on the same pattern.

## Branching canvas (shipped)

If/Else and A/B Split are now **true branches**, not just logged decisions:

- A workflow is a **tree** — `WorkflowBlock.branches` holds nested lanes
  (If/Else → `Yes` / `No`, A/B Split → `Path A` / `Path B`), each its own ordered
  list of blocks. Flat (branch-less) workflows stay valid, so older templates and
  recipes load unchanged.
- The **Builder** renders the lanes side-by-side under the branch block. Drag a
  palette block straight into a lane, click **Add step**, reorder within a lane with
  ↑/↓, and select/configure nested steps like any other. Published branching
  workflows round-trip through `rehydrateBlocks` (lanes are re-keyed recursively).
- The **engine** (`run-workflow`) executes recursively: If/Else evaluates its
  condition and runs **only** the matching lane; A/B Split honours the configured
  ratio (e.g. `70 / 30`). The run trace indents nested steps by depth, so you see
  exactly which path was taken. `steps_total` counts every nested block.
