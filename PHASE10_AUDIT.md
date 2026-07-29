# Launchpad Bylda — Phase 10 Audit

Status of the master-build audit checklist. **Verified** = confirmed
programmatically (DB / deployed function / build / tests). **Wired** = code
path is in place and type-checks/builds, but final confirmation needs an
interactive logged-in session.

Project: `ipidfqwlszuhjgjygbvx` · Branch: `claude/bylda-master-build-rqm60r`

## Verified

- ✅ **Build**: `bun run build` — zero errors. `tsc --noEmit` clean.
- ✅ **Tests**: 57 vitest cases passing (booking + casefile logic added).
- ✅ **Pipeline data**: 28 leads across all 6 stages
  (New 6 · Contacted 5 · Qualified 5 · Proposal 5 · Won 5 · Lost 2).
- ✅ **New tables + RLS**: conversations, calendar_events, booking_pages,
  automation_workflows, forms, form_submissions, tasks, tags, email_templates,
  campaigns, reputation_requests, campaign_events — all exist, RLS enabled.
- ✅ **Autonomous automation** (E2E proven): lead stage change → emit → enqueue
  → dispatch → workflow-engine. Triggers present on leads / form_submissions /
  calendar_events / conversations.
- ✅ **Edge functions** (22 ACTIVE): mentor-chat, crm-action, conversation-ai,
  workflow-engine, book-appointment, send-email, send-sms, send-campaign,
  process-reminders, receive-message, get-inbound-url, track-event (+ existing).
- ✅ **Delivery graceful-degrade**: send-\* no-op cleanly without provider keys;
  receive-message returns 503 without INBOUND_WEBHOOK_SECRET; track-event pixel
  (200 image/gif) + click (302) verified live.
- ✅ **Realtime**: conversations, leads, notifications in the publication;
  inbox + pipeline + bell subscribe.
- ✅ **Plan gates**: Mentors (Operate/Scale) and Contacts cap (0/500/2000/∞).
- ✅ **Security**: RLS on every new table; RPC EXECUTE revoked on trigger fns;
  new functions set search_path.

## Wired (needs an interactive session to tick)

- ⏳ Drag deal to a new column updates `leads.stage` (mutation + realtime wired).
- ⏳ Contact create / drawer tabs render (Deal & Contact drawers built).
- ⏳ Unified inbox Bylda Draft button (conversation-ai wired).
- ⏳ New appointment saves; public `/book/[slug]` submits (book-appointment live).
- ⏳ Workflow builder create/activate/test; form builder + public `/f/[id]`.
- ⏳ Campaign draft + Send Now + Report; reputation request send.
- ⏳ Founder Casefile renders from a real tool_run (route + mapper live).
- ⏳ Mobile: sidebar collapses, drawers full-screen (responsive classes in place).

## Operator toggles to reach live traffic (no code)

- Secrets: `RESEND_API_KEY` + `EMAIL_FROM`, `TWILIO_ACCOUNT_SID` /
  `TWILIO_AUTH_TOKEN` / `TWILIO_FROM`, `INBOUND_WEBHOOK_SECRET`.
- Extensions: enable `pg_cron` (activates scheduled campaigns + reminders;
  automations already fire via the app-nudge path).

## Remaining optional polish

- Automation/form builder drag-reorder.
- Edge-function structured logging / alerting.
